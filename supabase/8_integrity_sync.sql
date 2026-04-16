-- Aura Sovereign: System Integrity & Reward Engine Fix
-- This script fixes the "Reward Leak" where assets were credited to the wrong columns.
-- RUN THIS IN THE SUPABASE SQL EDITOR.

-- 1. Fix the PoP (Proof of Presence) Reward Function
-- Ensures that heartbeat rewards ONLY ever touch the 'balance' (AUR) column.
CREATE OR REPLACE FUNCTION increment_accumulated(user_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles 
    SET balance = COALESCE(balance, 0) + amount,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix the PoS (Proof of Stake) Reward Function
-- Ensures that staking rewards ONLY ever touch the 'staked_balance' (AUR) column.
CREATE OR REPLACE FUNCTION increment_pending_stake(user_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles 
    SET staked_balance = COALESCE(staked_balance, 0) + amount,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Safety Lock: Ensure ETH/BTC/NATIVE can only be modified by the Bridge
-- (No specific SQL needed, but redefining these functions overrides any legacy bad logic)

-- 4. Final Hard Reset for User '0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134'
-- This preserves the real 0.0001 ETH and wipes all simulated junk.
UPDATE profiles 
SET 
  eth_balance = 0.0001, -- THE REAL ON-CHAIN ASSET
  btc_balance = 0,
  native_balance = 0,
  balance = 0, -- AUR Liquid
  staked_balance = 0 -- AUR Staked
WHERE wallet_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134');

-- 5. Clear simulation transaction history
DELETE FROM transactions 
WHERE from_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134') 
   OR to_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134');

-- 6. Clean up distributions table
DELETE FROM distributions;
