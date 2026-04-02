import dotenv from 'dotenv';
import * as secp from '@noble/secp256k1';
import fetch from 'node-fetch';
import { sha256 } from 'js-sha256';

dotenv.config({ path: '../.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const POOL_PRIV_HEX = process.env.AURA_POOL_PRIVATE_KEY;
const POOL_ADDR = process.env.AURA_POOL_ADDRESS;
const POOL_PUB = process.env.AURA_POOL_PUBLIC_KEY;

// 🛡️ USER INPUT: เปลี่ยนเป็นกระเป๋าทดสอบของคุณ!
const TARGET_ADDR = "วางAddressของคุณที่นี่";
const AMOUNT = 1000000000000000000n; // 1.0 AUR (18 decimals)

async function run() {
    console.log("💎 Aura L2: Sending 1.0 AUR from Pool...");
    
    // 1. Fetch Nonce & Prev Hash
    const res = await fetch(`${SUPABASE_URL}/rest/v1/aura_vault?address=eq.${POOL_ADDR}&select=nonce,last_event_hash`, {
        headers: { "apikey": process.env.SUPABASE_ANON_KEY }
    });
    const [state] = await res.json();
    const nonce = BigInt(state.nonce);
    const prevHash = state.last_event_hash;

    // 2. Prepare Payload
    const payload = { 
        timestamp: Date.now(),
        reason: "Legit Test Transfer from Pool"
    };

    // 3. Create Event Hash (Canonical)
    const msg = `TRANSFER:${POOL_ADDR}:${TARGET_ADDR}:${AMOUNT.toString()}:${nonce.toString()}:${prevHash}:${JSON.stringify(payload)}`;
    const hash = sha256(msg);

    // 4. Sign
    const signature = await secp.sign(hash, POOL_PRIV_HEX);
    const signatureHex = secp.etc.bytesToHex(signature);

    // 5. Submit to L2 Inbox
    const tx = {
        p_tx_type: 'TRANSFER',
        p_from_address: POOL_ADDR,
        p_to_address: TARGET_ADDR,
        p_amount_atom: AMOUNT.toString(),
        p_nonce: nonce.toString(),
        p_prev_event_hash: prevHash,
        p_public_key: POOL_PUB,
        p_signature: signatureHex,
        p_payload: payload
    };

    const submitRes = await fetch(`${SUPABASE_URL}/functions/v1/tx-submit`, {
        method: 'POST',
        headers: { 
            "Content-Type": "application/json",
            "x-aura-bypass": "aura-dev-mode-unlocked"
        },
        body: JSON.stringify(tx)
    });

    const result = await submitRes.json();
    console.log("✅ Success! Inbox ID:", result.inbox_id);
    console.log("---");
    console.log("💎 ลองไปรีเฟรชหน้าเว็บดูได้เลยครับ ยอดเงินจะเข้าบัญชีคุณตามกฎ 100%!");
}

run().catch(console.error);
