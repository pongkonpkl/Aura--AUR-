import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { ethers } from "https://esm.sh/ethers@6.11.1"

// 🛸 AURA SOVEREIGN SERVERLESS BRIDGE RELAYER
// This function is triggered by a Database Webhook on the 'transactions' table.

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record, type } = payload

    // 1. Only process NEW 'bridge_out' requests that are 'pending'
    if (type !== 'INSERT' || record.tx_type !== 'bridge_out' || record.status !== 'pending') {
      return new Response("Not a pending bridge_out request", { status: 200 })
    }

    console.log(`🚀 TRIGGERED: Processing Bridge Out for TX ID [${record.id}]`)

    // 2. Load Environment Secrets
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const RPC_URL = Deno.env.get("RPC_URL")!
    const RELAYER_PRIVATE_KEY = Deno.env.get("RELAYER_PRIVATE_KEY")!

    if (!RELAYER_PRIVATE_KEY || !RPC_URL) {
      throw new Error("Missing RELAYER_PRIVATE_KEY or RPC_URL in Supabase Secrets")
    }

    // 3. Initialize Clients
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider)

    const assetType = record.error_log // we store asset type in error_log temporarily
    const amountStr = record.amount.toString()
    const targetAddress = record.to_address

    console.log(`⚙️  L1 EGRESS: Sending ${amountStr} ${assetType} to ${targetAddress}`)

    try {
      if (assetType !== 'ETH') {
          // Mock non-EVM assets for now
          await finalizeTx(supabase, record.id, "0x_serverless_mock_" + Date.now())
          return new Response("Non-ETH asset mocked successfully", { status: 200 })
      }

      // 4. Validate Address
      if (!ethers.isAddress(targetAddress)) {
          await refundTx(supabase, record.id, "Invalid Target Address")
          return new Response("Invalid Address - Refunded", { status: 200 })
      }

      // 5. Execute L1 Transaction
      const amountWei = ethers.parseEther(amountStr)
      const txResponse = await wallet.sendTransaction({
          to: targetAddress,
          value: amountWei
      })

      console.log(`🕒 L1 Broadcasted! Hash: ${txResponse.hash}`)
      
      // Wait for 1 confirmation (Edge functions have a 60s timeout usually, 1 block on Sepolia is ~12s)
      const receipt = await txResponse.wait(1)
      console.log(`✅ L1 Confirmed in block ${receipt?.blockNumber}`)

      // 6. Update Ledger
      await finalizeTx(supabase, record.id, txResponse.hash)
      
      return new Response("Bridge Success", { status: 200 })

    } catch (err) {
      console.error("❌ L1 Execution Failed:", err.message)
      await refundTx(supabase, record.id, err.message)
      return new Response(`Bridge Failed & Refunded: ${err.message}`, { status: 500 })
    }

  } catch (err) {
    console.error("❌ Fatal Error:", err.message)
    return new Response(err.message, { status: 500 })
  }
})

async function finalizeTx(supabase: any, id: string, hash: string) {
    const { error } = await supabase
        .from('transactions')
        .update({ status: 'success', tx_hash: hash })
        .eq('id', id)
    if (error) console.error("Finalize Error:", error)
}

async function refundTx(supabase: any, id: string, reason: string) {
    const { data, error } = await supabase.rpc('rpc_bridge_refund', {
        p_tx_id: id,
        p_reason: reason
    })
    if (error) console.error("Refund Error:", error)
}
