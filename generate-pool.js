const crypto = require('crypto');
const fs = require('fs');
const bs58 = require('bs58');
const elliptic = require('elliptic');
const ec = new elliptic.ec('secp256k1');

function generateAuraKeypair() {
  const key = ec.genKeyPair();
  const privHex = key.getPrivate('hex');
  const pubBytes = Buffer.from(key.getPublic(true, 'array'));
  const pubHex = pubBytes.toString('hex');
  const sha256 = crypto.createHash('sha256').update(pubBytes).digest();
  const address = bs58.encode(sha256);

  const output = `--- AURA POOL KEYPAIR GENERATED ---
Address:     ${address}
Public Key:  ${pubHex}
Private Key: ${privHex}
------------------------------------

--- SQL FOR SUPABASE ---
-- 1. Register the Pool Account
select public.register_account('${address}', '${pubHex}');

-- 2. Daily Mint (Today: 2026-03-30)
select public.mint_daily_aura('${address}');
`;
  fs.writeFileSync('setup_result.txt', output);
  console.log('Setup result saved to setup_result.txt');
}

generateAuraKeypair();
