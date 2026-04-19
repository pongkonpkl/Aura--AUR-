import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ethers } from "https://esm.sh/ethers@6.11.1"

serve(async (req) => {
  try {
    const { record } = await req.json()
    const tx_hash_id = record.id
    const payload = record.payload // JSON object: { op, tx, signature }
    const status = record.status

    if (status !== 'pending') {
      return new Response("Not a pending transaction", { status: 200 })
    }

    const { op, tx, signature } = payload
    const from_address = record.from_address.toLowerCase()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Reconstruct message variants (Synchronized with Dashboard.tsx V2 Protocol)
    const messageVariants: string[] = []
    
    // V1 Legacy Template
    const prefixV1 = "[Aura Sovereign v1] "
    if (op === 'transfer') {
      messageVariants.push(`${prefixV1}AUR_TX:${tx.nonce}:${from_address}:${tx.to_address.toLowerCase()}:${tx.amount_atom}`)
    } else if (op === 'stake') {
      messageVariants.push(`${prefixV1}AUR_STAKE:${tx.nonce}:${from_address}:${tx.amount_atom}`)
    } else if (op === 'unstake') {
      messageVariants.push(`${prefixV1}AUR_UNSTAKE:${tx.nonce}:${from_address}:${tx.amount_atom}`)
    }

    // V2 Canonical Protocol (Pipe-Separated Strict Formatting)
    const v2_op = op.toUpperCase()
    const v2_to = op === 'transfer' ? (tx.to_address || "").toLowerCase().trim() : ""
    const v2_amt = (op !== 'claim' && tx.amount_atom) ? String(tx.amount_atom).trim() : ""
    const msg_v2 = `[AURA|V2]|${v2_op}|${tx.nonce}|${from_address}|${v2_to}|${v2_amt}`
    messageVariants.push(msg_v2)

    // 2. Multi-Variant Cryptographic Signature Verification
    let verified = false
    let recoveredAddress = "RECOVERY_FAILED"
    
    for (const msg of messageVariants) {
      try {
        const recovered = ethers.verifyMessage(msg, signature).toLowerCase()
        if (recovered === from_address) {
          verified = true
          break
        }
        recoveredAddress = recovered // Store last mismatch for diagnostic log
      } catch (e) {
        console.error(`Verification Error for variant: ${msg}`, e)
      }
    }

    if (!verified) {
      const log = `ERR_001: Signature mismatch. Recovered: ${recoveredAddress}. Expected: ${from_address}. Variants tried: ${messageVariants.length}`
      await updateStatus(supabase, tx_hash_id, 'failed', log)
      return new Response("Unauthorized", { status: 401 })
    }

    // 3. Atomic Settlement via RPC
    let rpcResponse: any
    if (op === 'transfer') {
      rpcResponse = await supabase.rpc('rpc_settle_transfer', {
        p_from_address: from_address,
        p_to_address: tx.to_address.toLowerCase(),
        p_amount_atom: tx.amount_atom,
        p_nonce: tx.nonce,
        p_tx_hash_id: tx_hash_id
      })
    } else if (['stake', 'unstake'].includes(op)) {
      rpcResponse = await supabase.rpc('rpc_settle_staking', {
        p_op: op,
        p_address: from_address,
        p_amount_atom: tx.amount_atom,
        p_nonce: tx.nonce,
        p_tx_hash_id: tx_hash_id
      })
    }

    if (rpcResponse.error) {
       await updateStatus(supabase, tx_hash_id, 'failed', `ERR_003: RPC Error: ${rpcResponse.error.message}`)
       return new Response("Settlement failed", { status: 500 })
    }

    const result = rpcResponse.data
    if (result && result.success) {
      return new Response(JSON.stringify({ message: "Transaction Validated & Settled" }), { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      })
    } else {
      const err = result?.error || "Unknown error"
      await updateStatus(supabase, tx_hash_id, 'failed', `ERR_002: ${err}`)
      return new Response("Validation logic failed", { status: 200 })
    }

  } catch (err) {
    return new Response(err.message, { status: 500 })
  }
})

async function updateStatus(supabase: any, id: string, status: string, log: string) {
  await supabase.from('transactions').update({ 
    status: status, 
    error_log: log 
  }).eq('id', id)
}
