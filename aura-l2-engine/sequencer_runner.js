/**
 * 🌀 Aura L2 Sequencer Runner (Simulation Script)
 * This script pings your Supabase Edge Function to produce blocks and finalize batches.
 * 
 * Usage:
 * 1. Set your SUPABASE_PROJECT_ID and SERVICE_ROLE_KEY.
 * 2. Run: node sequencer_runner.js
 */

const PROJECT_ID = "xjdsvbptsksjrdsredim"; 
const SERVICE_ROLE_KEY = "sb_secret_d0Ma9T302GotEZ3wdgB-4Q_O0C4yTZu"; 
const INTERVAL_MS = 5000; // 5 seconds

const FUNCTION_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/aura-sequencer`;

async function tick() {
    console.log(`[${new Date().toLocaleTimeString()}] 🔄 Pinging Sequencer...`);
    try {
        const response = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'x-aura-bypass': 'aura-dev-mode-unlocked'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ HTTP Error ${response.status}: ${errText}`);
            return;
        }

        const data = await response.json();
        if (data.ok) {
            console.log("✅ Sequencer Run Successful:");
            data.logs.forEach(log => {
                if (log.status === "ok") {
                    console.log(`   - ${log.step}: ${JSON.stringify(log)}`);
                } else {
                    console.warn(`   - ${log.step}: FAILED - ${log.message}`);
                }
            });
        } else {
            console.error("❌ Sequencer Error:", data.error);
        }
    } catch (e) {
        console.error("❌ Connection Failed:", e.message);
    }
}

console.log("🌀 Aura L2 Sequencer started...");
console.log(`📡 Targeting: ${FUNCTION_URL}`);
console.log(`⏲️  Interval: ${INTERVAL_MS / 1000}s`);

setInterval(tick, INTERVAL_MS);
tick();
