/**
 * 🛡️ Aura L2 Verifier Tool (Trust-Minimization)
 * This tool fetches a batch's DA data and verifies its data_hash.
 * 
 * Usage:
 * 1. Set your SUPABASE_PROJECT_ID and SERVICE_ROLE_KEY.
 * 2. Run: node verify_l2.js [batch_id]
 */

const crypto = require('crypto');

const PROJECT_ID = "xjdsvbptsksjrdsredim"; 
const SERVICE_ROLE_KEY = "sb_secret_d0Ma9T302GotEZ3wdgB-4Q_O0C4yTZu"; 

async function verifyBatch(batchId) {
    if (!batchId) {
        console.error("❌ Batch ID required: node verify_l2.js [batch_id]");
        process.exit(1);
    }

    console.log(`🛡️ Verifying Batch #${batchId}...`);

    try {
        // 1. Fetch Batch Metadata
        const baseUrl = `https://${PROJECT_ID}.supabase.co/rest/v1/l2_batches?batch_id=eq.${batchId}`;
        const batchMeta = await fetch(baseUrl, {
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            }
        }).then(res => res.json());

        if (batchMeta.length === 0) {
            console.error(`❌ Batch #${batchId} not found.`);
            return;
        }

        const expectedDataHash = batchMeta[0].data_hash;
        console.log(`- Expected Data Hash: ${expectedDataHash}`);

        // 2. Fetch Full DA Data for Reconstruction
        // In a real Rollup, this would be from L1 calldata or a DA layer.
        // Here we fetch it using the specialized DA RPC we created.
        const rpcUrl = `https://${PROJECT_ID}.supabase.co/rest/v1/rpc/get_batch_da_data`;
        const daData = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ p_batch_id: batchId })
        }).then(res => res.json());

        if (daData.error) {
            throw new Error(`DA Error: ${daData.error.message}`);
        }

        // 3. Reconstruct Canonical JSON and Compute Hash
        const canonicalString = JSON.stringify(daData);
        const computedHash = crypto.createHash('sha256').update(canonicalString).digest('hex');

        console.log(`- Computed Data Hash: ${computedHash}`);

        // 4. Comparison Results
        if (computedHash === expectedDataHash) {
            console.log("\n✅ VERIFICATION SUCCESSFUL!");
            console.log("The transaction data for this batch matches the hash committed to the chain.");
            console.log(`Verified ${daData.length} items across all blocks in this batch.`);
        } else {
            console.error("\n❌ VERIFICATION FAILED!");
            console.error("Mismatch between local reconstruction and committed state. FRAUD DETECTED!");
        }

    } catch (e) {
        console.error("❌ Error during verification:", e.message);
    }
}

const batchId = process.argv[2];
verifyBatch(batchId);
