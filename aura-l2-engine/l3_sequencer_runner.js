import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 🌀 AURA L3 HYPER-PULSE SEQUENCER 🌀
 * This runner automates:
 * 1) L3 Block Production (High Speed)
 * 2) L3-to-L2 Recursive Settlement (Checkpointing)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BLOCK_INTERVAL = 2000; // 2 Seconds for L3
const BATCH_INTERVAL = 60000; // 1 Minute for L2 Settlement

let lastBlockNumber = 0;
let lastSettledBlock = 0;

async function produceL3Block() {
  try {
    const response = await axios.post(
      `${SUPABASE_URL}/rest/v1/rpc/l3_sequencer_produce_block`,
      { p_max_txs: 50 },
      {
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          'x-aura-bypass': 'aura-dev-mode-unlocked'
        }
      }
    );

    const blockNumber = response.data;
    if (blockNumber > lastBlockNumber) {
      console.log(`[L3 PULSE] ⚡ Produced Block #${blockNumber}`);
      lastBlockNumber = blockNumber;
    }
  } catch (err) {
    console.error(`[L3 ERROR] Block Production Failed:`, err.response?.data || err.message);
  }
}

async function settleL3ToL2() {
  if (lastBlockNumber <= lastSettledBlock) {
     console.log(`[L3 SETTLE] ⏳ No new blocks to settle onto L2.`);
     return;
  }

  try {
    console.log(`[L3 SETTLE] 🌀 Preparing Recursive Checkpoint for L3 Range ${lastSettledBlock + 1}-${lastBlockNumber}...`);
    
    const response = await axios.post(
      `${SUPABASE_URL}/rest/v1/rpc/l3_post_checkpoint_to_l2`,
      { 
        p_from_block: lastSettledBlock + 1,
        p_to_block: lastBlockNumber 
      },
      {
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          'x-aura-bypass': 'aura-dev-mode-unlocked'
        }
      }
    );

    const checkpointId = response.data;
    console.log(`[L3 SETTLE] ✅ Recursive Success! Checkpoint ID #${checkpointId} posted to L2 Inbox.`);
    lastSettledBlock = lastBlockNumber;
  } catch (err) {
    console.error(`[L3 ERROR] L2 Settlement Failed:`, err.response?.data || err.message);
  }
}

// 🛡️ RUNNER LOOPS
console.log("🌀 Aura L3 Hyper-Pulse Sequencer Starting...");
console.log(`- Block Interval: ${BLOCK_INTERVAL}ms`);
console.log(`- Batch Interval: ${BATCH_INTERVAL}ms`);

setInterval(produceL3Block, BLOCK_INTERVAL);
setInterval(settleL3ToL2, BATCH_INTERVAL);
