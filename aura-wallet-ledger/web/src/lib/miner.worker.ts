// 🛡️ Aura Sovereign Miner: Quantum Hashing Engine (Native Optimized)
// Version: 2.0.0
// Description: Uses browser-native SubtleCrypto for dependency-free, high-speed SHA-256.

let isMining = false;
let currentSeed = '';
let currentTarget = '';
let walletAddress = '';
let jobId = '';

const encoder = new TextEncoder();

async function hexToBytes(hex: string) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

function bufferToHex(buffer: ArrayBuffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

self.onmessage = async (e) => {
    const { type, data } = e.data;

    if (type === 'start') {
        isMining = true;
        currentSeed = data.seed;
        currentTarget = data.difficultyTarget;
        walletAddress = data.walletAddress;
        jobId = data.jobId;
        console.log('[Sovereign Miner] Engine Engaged:', { jobId, target: currentTarget.slice(0, 10) + '...' });
        
        try {
            await mine();
        } catch (err) {
            self.postMessage({ type: 'error', data: { message: err.message } });
        }
    } else if (type === 'stop') {
        isMining = false;
        console.log('[Sovereign Miner] Engine Disengaged.');
    }
};

async function mine() {
    let nonce = Math.floor(Math.random() * 2147483647);
    let hashesFound = 0;
    let lastReportTime = Date.now();
    
    // Pre-encode static parts for marginal speed gain
    const seedBytes = encoder.encode(currentSeed + walletAddress);
    
    while (isMining) {
        const nonceStr = nonce.toString();
        const nonceBytes = encoder.encode(nonceStr);
        
        // Combine bytes
        const input = new Uint8Array(seedBytes.length + nonceBytes.length);
        input.set(seedBytes);
        input.set(nonceBytes, seedBytes.length);

        // Native High-Speed Hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', input);
        const hashHex = bufferToHex(hashBuffer);

        // 🏆 Profit Check: Meets Difficulty?
        if (hashHex <= currentTarget) {
            self.postMessage({
                type: 'solution',
                data: {
                    nonce: nonceStr,
                    hash: hashHex,
                    jobId: jobId
                }
            });
        }

        nonce++;
        hashesFound++;

        // Telemetry Reporting Loop (Every 1.5s)
        const now = Date.now();
        if (now - lastReportTime > 1500) {
            const duration = (now - lastReportTime) / 1000;
            const hashRate = Math.floor(hashesFound / duration);
            
            self.postMessage({
                type: 'stats',
                data: {
                    hashRate: hashRate,
                    totalHashes: hashesFound
                }
            });
            
            lastReportTime = now;
            hashesFound = 0;

            // Micro-yield to keep worker responsive to 'stop' messages
            await new Promise(r => setTimeout(r, 0));
        }
        
        // Batching Yield (Every 1000 hashes)
        if (hashesFound % 1000 === 0) {
            await new Promise(r => setTimeout(r, 0));
        }
    }
}
