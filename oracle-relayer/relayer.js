require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');

// 1. App Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RPC_URL = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo';
const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY || !PRIVATE_KEY) {
    console.error("❌ CRITICAL: Missing Environment Variables in .env file.");
    process.exit(1);
}

// 2. Initialize Core Clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log("==========================================");
console.log("🛸 AURA SOVEREIGN RELAYER NODE ONLINE 🛸");
console.log("==========================================");
console.log(`📡 Linked Network: Sepolia Testnet`);
console.log(`🏦 Vault Address: ${wallet.address}`);
console.log("==========================================");

// 3. Polling Engine
async function pollPendingTransactions() {
    try {
        const { data: pendingTxs, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('status', 'success')
            .eq('tx_type', 'bridge_out')
            .is('tx_hash', null);

        if (error) {
            console.error("❌ Supabase Read Error:", error);
            return;
        }

        if (!pendingTxs || pendingTxs.length === 0) {
            return; // Nothing to process
        }

        console.log(`\n🚨 DETECTED ${pendingTxs.length} PENDING BRIDGE REQUEST(S)!`);

        for (const tx of pendingTxs) {
            await processTransaction(tx);
        }

    } catch (err) {
        console.error("❌ Fatal Polling Error:", err);
    }
}

async function processTransaction(tx) {
    const assetType = tx.error_log;  // We store asset type temporarily in error_log
    const amountStr = tx.amount.toString();
    const targetAddress = tx.to_address; 

    console.log(`\n==========================================`);
    console.log(`⚙️ PROCESSING L1 EGRESS: [${tx.id}]`);
    console.log(`   ASSET:  ${assetType}`);
    console.log(`   AMOUNT: ${amountStr}`);
    console.log(`   DEST:   ${targetAddress}`);
    console.log(`==========================================`);

    try {
        if (assetType !== 'ETH') {
           // Only ETH operates natively on the EVM script. Other assets pass through different sovereign gates.
           console.log(`⚠️ MOCKING ${assetType} Egress... (Not an EVM native token)`);
           await finalizeInSupabase(tx.id, "0x_mock_hash_for_non_evm_" + Date.now());
           return;
        }

        // Validate Destination
        if (!ethers.isAddress(targetAddress)) {
            console.error(`❌ INVALID DESTINATION ADDRESS: ${targetAddress}`);
            await markFailedInSupabase(tx.id, "Invalid Target Address");
            return;
        }

        // Construct Transaction
        const amountWei = ethers.parseEther(amountStr);
        console.log(`📡 Sending ${amountStr} ETH to ${targetAddress} on Network...`);
        
        // Execute on Blockchain
        const ethTx = await wallet.sendTransaction({
            to: targetAddress,
            value: amountWei
        });

        console.log(`🕒 Transaction broadcasted! Hash: ${ethTx.hash}`);
        console.log(`⏳ Waiting for network confirmation...`);
        
        const receipt = await ethTx.wait(1); // Wait for block confirmation
        
        console.log(`✅ CONFIRMED IN L1 BLOCK [${receipt.blockNumber}]`);
        
        // Update the Supabase ledger with the real Tx Hash
        await finalizeInSupabase(tx.id, ethTx.hash);

    } catch (error) {
        console.error("❌ Bridge Execution Failed:", error.message);
        await markFailedInSupabase(tx.id, error.message);
    }
}

async function finalizeInSupabase(txId, txHash) {
    const { error } = await supabase
        .from('transactions')
        .update({ 
            status: 'success', 
            tx_hash: txHash,
        })
        .eq('id', txId);

    if (error) {
         console.error(`❌ Failed to update Supabase for tx ${txId}:`, error);
    } else {
         console.log(`💾 Ledger Updated successfully for Tx ID: ${txId}`);
    }
}

async function markFailedInSupabase(txId, reason) {
    await supabase
        .from('transactions')
        .update({ 
            status: 'failed', 
            error_log: reason,
        })
        .eq('id', txId);
}

// Start Polling Loop (Every 5 seconds)
setInterval(pollPendingTransactions, 5000);
console.log("👁️  Listening for Bridge Out requests from Supabase...");
