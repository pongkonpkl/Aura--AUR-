import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import bs58 from "bs58";

function toHex(u8) { return Buffer.from(u8).toString("hex"); }
function base58(u8) { return bs58.encode(Buffer.from(u8)); }

const priv = secp256k1.utils.randomPrivateKey(); // 32 bytes
const pubCompressed = secp256k1.getPublicKey(priv, true); // 33 bytes
const pubHash = sha256(pubCompressed); // 32 bytes
const address = base58(pubHash); // Base58(SHA256(pubkey_bytes))

console.log("--- GENERATED AURA POOL KEYS ---");
console.log("pool_private_key_hex:", toHex(priv));
console.log("pool_public_key_compressed_hex:", toHex(pubCompressed));
console.log("pool_address_base58_sha256(pubkey):", address);
console.log("pubkey_bytes_len:", pubCompressed.length);
console.log("--------------------------------");
