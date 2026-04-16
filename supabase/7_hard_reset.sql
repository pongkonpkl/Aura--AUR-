-- Aura Sovereign: Hard Reset & Professional Sanitization
-- This script cleans up all simulation "noise" and sets the ledger to its real-world state.

-- 1. Reset Profile Balances to 100% Reality (0.0001 ETH)
UPDATE profiles 
SET 
  eth_balance = 0.0001,
  btc_balance = 0,
  native_balance = 0,
  balance = 0,
  staked_balance = 0
WHERE wallet_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134');

-- 2. Clear ALL Transaction History for the user (Simulation Records)
DELETE FROM transactions 
WHERE from_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134') 
   OR to_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134');

-- 3. Reset Heartbeat Logs to free up space
DELETE FROM mining_logs 
WHERE user_id = (SELECT id FROM profiles WHERE wallet_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134'));

-- 4. Clean up the global Distribution ledger to match the reset
DELETE FROM distributions;
