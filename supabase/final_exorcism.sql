-- Aura Sovereign: THE FINAL EXORCISM
-- This is the most aggressive cleanup script to remove all Ghost Triggers.
-- RUN THIS IN THE SUPABASE SQL EDITOR.

-- 1. DESTROY ALL POSSIBLE GHOST TRIGGERS (Querying system tables for safety)
DO $$ 
DECLARE 
    trig RECORD;
BEGIN 
    FOR trig IN (
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE event_object_table IN ('mining_logs', 'profiles', 'transactions', 'distributions')
    ) 
    LOOP 
        BEGIN
            EXECUTE 'DROP TRIGGER IF EXISTS ' || trig.trigger_name || ' ON ' || trig.event_object_table || ' CASCADE';
            RAISE NOTICE 'Dropped ghost trigger: %', trig.trigger_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop trigger %: %', trig.trigger_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 2. WIPE THE SLATE CLEAN (Nuclear Reset)
-- This clears all simulated history that might be causing auto-increments
TRUNCATE TABLE mining_logs CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE distributions CASCADE;

-- 3. RESET THE SOVEREIGN LEDGER (0.0001 ETH Reality)
UPDATE profiles 
SET 
    eth_balance = 0.0001,
    balance = 0,
    staked_balance = 0,
    native_balance = 0,
    btc_balance = 0
WHERE wallet_address ILIKE '%0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134%';

-- 4. RE-LOCK THE REWARD FUNCTIONS
-- Ensures NO automated rewards touch ETH/BTC columns.
CREATE OR REPLACE FUNCTION increment_accumulated(user_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles SET balance = COALESCE(balance, 0) + amount WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_pending_stake(user_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles SET staked_balance = COALESCE(staked_balance, 0) + amount WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. VACUUM THE DB
VACUUM ANALYZE profiles;
