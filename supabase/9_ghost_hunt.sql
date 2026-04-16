-- Aura Sovereign: Ghost Hunt Exorcism (Final Cleanup)
-- This script destroys all legacy simulation triggers and resets the user to 100% reality.
-- RUN THIS IN THE SUPABASE SQL EDITOR.

-- 1. IDENTIFY & DESTROY GHOST TRIGGERS
-- We drop any triggers that might be causeing the "auto-inflow" mess
DROP TRIGGER IF EXISTS trigger_auto_reward ON mining_logs;
DROP TRIGGER IF EXISTS trigger_simulate_inflow ON mining_logs;
DROP TRIGGER IF EXISTS pop_reward_trigger ON mining_logs;
DROP TRIGGER IF EXISTS tr_mining_reward ON mining_logs;

-- Any trigger on profiles that might be linked
DROP TRIGGER IF EXISTS trigger_profile_balance_watch ON profiles;

-- 2. RESET THE LEDGER TO 100% TRUTH (0.0001 ETH)
UPDATE profiles 
SET 
  eth_balance = 0.0001, 
  btc_balance = 0,
  native_balance = 0,
  balance = 0,
  staked_balance = 0
WHERE wallet_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134');

-- 3. CLEAR SIMULATED HISTORY
DELETE FROM transactions 
WHERE from_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134') 
   OR to_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134');

-- 4. CLEAN DISTRIBUTIONS
DELETE FROM distributions;

-- 5. VACUUM LOGS (Prevent ghostly artifacts)
DELETE FROM mining_logs;

-- 6. REDEFINE THE REWARD FUNCTION TO BE SAFE (NO ETH TOUCHING)
CREATE OR REPLACE FUNCTION increment_accumulated(user_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles 
    SET balance = COALESCE(balance, 0) + amount,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
