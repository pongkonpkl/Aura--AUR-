import CryptoJS from 'crypto-js';

// 🛡️ Aura Sovereign Miner: Zero-Lag Web Worker Engine
// This worker performs cryptographic hashing in a background thread to keep the main UI responsive.

let isMining = false;
let currentSeed = '';
let currentTarget = '';
let walletAddress = '';
let jobId = '';

self.onmessage = (e) => {
  const { type, data } = e.data;

  if (type === 'start') {
    isMining = true;
    currentSeed = data.seed;
    currentTarget = data.difficultyTarget;
    walletAddress = data.walletAddress;
    jobId = data.jobId;
    console.log('[Worker] Starting cluster with seed:', currentSeed);
    mine();
  } else if (type === 'stop') {
    isMining = false;
    console.log('[Worker] Cluster halted.');
  }
};

async function mine() {
  let nonce = Math.floor(Math.random() * 10000000);
  let hashesFound = 0;
  let lastReportTime = Date.now();

  const targetHex = currentTarget;

  while (isMining) {
    const nonceStr = nonce.toString();
    const input = currentSeed + walletAddress + nonceStr;
    const hash = CryptoJS.SHA256(input).toString();

    // 🏆 Level 1: Share found (Meets difficulty)
    if (hash <= targetHex) {
      self.postMessage({
        type: 'solution',
        data: {
          nonce: nonceStr,
          hash: hash,
          jobId: jobId
        }
      });
      console.log('[Worker] Share submitted! Nonce:', nonceStr);
    }

    nonce++;
    hashesFound++;

    // Statistics Reporting every 2 seconds
    const now = Date.now();
    if (now - lastReportTime > 2000) {
      const hashRate = Math.floor((hashesFound / (now - lastReportTime)) * 1000);
      self.postMessage({
        type: 'stats',
        data: {
          hashRate: hashRate,
          totalHashes: hashesFound
        }
      });
      lastReportTime = now;
      hashesFound = 0;
      
      // Artificial sleep to prevent 100% CPU usage and allow worker to process stop messages
      await new Promise(r => setTimeout(r, 10));
    }
    
    // Prevent infinite loop without yielding
    if (nonce % 500 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }
}
