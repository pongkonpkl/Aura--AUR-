# Aura Blockchain (AUR) Setup Guide

This guide provides everything needed to initialize the Aura Blockchain according to the provided "Ready-made" instructions.

## 1. Database Schema (Supabase/PostgreSQL)
File: `schema.sql`

Use this SQL to set up your Supabase database. It includes:
- **Hardened Account Registration**: `public_key` is immutable once set for an address.
- **Replay Protection**: Uses `nonce` and `last_out_event_hash` (anchor).
- **Append-only Ledger**: Updates and deletes are blocked by triggers.
- **Atomic Transfers**: Row-level locking ensures no race conditions during balance updates.
- **Daily Minting**: System-level logic for 1 AUR/day distribution.

## 2. Pool Key Generation (Node.js)
File: `generate-pool.js`

This script generates a secure `secp256k1` keypair and an address using the specified logic: `Base58(SHA256(pubkey_bytes))`.

### Usage:
1. Open a terminal in the project folder.
2. Run `npm install` (installs `bs58` and `elliptic`).
3. Run `node generate-pool.js` to see the results.

## 3. Initialization SQL (For 2026-03-30 UTC)
Use these SQL commands in your Supabase SQL Editor after running `schema.sql`.

```sql
-- 1. Register the Aura Common Pool Account
-- Address: HKikDWUm4uM8Fi1ji3P6PuZJTH8rXGiBuKnaRshfhdsW
select public.register_account(
  'HKikDWUm4uM8Fi1ji3P6PuZJTH8rXGiBuKnaRshfhdsW', 
  '031e1484bfcef69929dc97bfa1cb5a4703fc382340acaaff3d9d51a9de473ec73c'
);

-- 2. Daily Mint (Today: 2026-03-30)
-- This performs the first mint into the newly created pool.
select public.mint_daily_aura('HKikDWUm4uM8Fi1ji3P6PuZJTH8rXGiBuKnaRshfhdsW');
```

---
### Important Note on Security
The generated pool keys are:
- **Address**: `HKikDWUm4uM8Fi1ji3P6PuZJTH8rXGiBuKnaRshfhdsW`
- **Public Key**: `031e1484bfcef69929dc97bfa1cb5a4703fc382340acaaff3d9d51a9de473ec73c`
- **Private Key**: `13042a5c9aaf5b1f2b1ae4b27a0835dc83d9eb6701f08e60aa6730bae267f2bd`

**Keep the private key safe!** If lost, you cannot sign transactions from the pool.
