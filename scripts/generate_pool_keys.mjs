import { secp256k1 } from "npm:@noble/curves/secp256k1";
import { sha256 } from "npm:@noble/hashes/sha256";
import bs58 from "npm:bs58";

/**
 * Script to generate a fresh Aura Pool Keypair.
 * Run with: deno run --allow-all scripts/generate_pool_keys.mjs
 */

async function generatePool() {
  const priv = secp256k1.utils.randomPrivateKey();
  const pub = secp256k1.getPublicKey(priv, true);
  const hash = sha256(pub);
  const addr = bs58.encode(hash);

  const result = {
    address: addr,
    publicKey: Buffer.from(pub).toString('hex'),
    privateKey: Buffer.from(priv).toString('hex'),
    createdAt: new Date().toISOString()
  };

  console.log("--- START POOL KEY GEN ---");
  console.log(JSON.stringify(result, null, 2));
  console.log("--- END POOL KEY GEN ---");
  
  // Also save to a local secret file (ignored by git ideally)
  await Deno.writeTextFile("pool.secret.json", JSON.stringify(result, null, 2));
  console.log("\n[INFO] Saved to pool.secret.json");
}

generatePool();
