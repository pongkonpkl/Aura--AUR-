-- 🛡️ Aura Sovereign: Smart Global Statistics Protocol
-- Version: 1.1.1
-- Description: Implement atomic stats synchronization for Total Supply and Daily Pulse.
-- This script safely updates the live system to enable "Smart Stats".

-- 0. Cleanup to prevent return type mismatch errors
DROP FUNCTION IF EXISTS rpc_recalculate_global_stats();

-- 1. Helper: Recalculate Global Stats
-- Sums all balances (Liquid + Staked) to provide a 100% accurate Total Supply.
CREATE OR REPLACE FUNCTION rpc_recalculate_global_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_supply NUMERIC;
    v_daily_target NUMERIC := 2000000000000000000; -- 2.0 AUR (Hybrid: 1.0 Staking + 1.0 Mining)
BEGIN
    -- Sum all balances across all shards
    SELECT COALESCE(SUM(balance_atom::NUMERIC + staked_balance_atom::NUMERIC), 0)
    INTO v_total_supply
    FROM profiles;

    -- Update Global Stats Table
    UPDATE sovereign_stats
    SET 
        total_supply_atom = v_total_supply,
        daily_mined_atom = v_daily_target,
        updated_at = NOW()
    WHERE id = 'global';

    RETURN jsonb_build_object(
        'success', true,
        'total_supply', v_total_supply,
        'daily_mined', v_daily_target
    );
END;
$$;

-- 2. Updated Settlement: Settle Mining Rewards (Hourly Distribution)
-- This version adds a call to rpc_recalculate_global_stats() at the end.
CREATE OR REPLACE FUNCTION rpc_settle_mining_rewards()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_shares BIGINT;
    v_pool_amount NUMERIC;
    v_reward_per_share NUMERIC;
    v_settled_count INTEGER := 0;
BEGIN
    -- [A] Calculate Total Shares
    SELECT SUM(mining_shares) INTO v_total_shares FROM profiles WHERE mining_shares > 0;
    
    IF v_total_shares IS NULL OR v_total_shares = 0 THEN
        -- Still update stats even if no shares, just in case pulse needs refreshing
        PERFORM rpc_recalculate_global_stats();
        RETURN jsonb_build_object('success', true, 'message', 'No shares to settle. Stats synchronized.');
    END IF;
    
    -- [B] Get Hourly Pool (Daily Pool / 24)
    SELECT (mining_pool_atom_daily / 24) INTO v_pool_amount FROM sovereign_stats WHERE id = 'global';
    
    v_reward_per_share := v_pool_amount / v_total_shares;
    
    -- [C] Distribute & Reset (Atomic Sharded Batch)
    -- We do this in two steps: 
    -- 1. Log to Transactions (Activity Feed)
    INSERT INTO transactions (
        tx_hash,
        from_address,
        to_address,
        amount,
        tx_type,
        signature,
        status,
        created_at
    )
    SELECT 
        'reward-' || encode(digest(p.address::text || now()::text || random()::text, 'sha256'), 'hex'),
        'System',
        '0x' || encode(p.address, 'hex'),
        (p.mining_shares * v_reward_per_share)::TEXT,
        'reward',
        'Protocol Consensus',
        'completed',
        NOW()
    FROM profiles p
    WHERE p.mining_shares > 0;

    -- 2. Update Balances
    UPDATE profiles 
    SET 
        balance_atom = balance_atom + (mining_shares * v_reward_per_share),
        total_mined_atom = total_mined_atom + (mining_shares * v_reward_per_share),
        mining_shares = 0
    WHERE mining_shares > 0;
    
    GET DIAGNOSTICS v_settled_count = ROW_COUNT;
    
    -- [D] Rotate Seed for next epoch
    UPDATE sovereign_mining_jobs SET is_active = false WHERE is_active = true;
    INSERT INTO sovereign_mining_jobs (seed, difficulty_target)
    VALUES (
        encode(digest(now()::text || random()::text, 'sha256'), 'hex'),
        (SELECT difficulty_target FROM sovereign_stats WHERE id = 'global')
    );
    
    -- [E] SMART STATS: Sync total supply after minting new coins
    PERFORM rpc_recalculate_global_stats();
    
    RETURN jsonb_build_object(
        'success', true, 
        'settled_wallets', v_settled_count, 
        'total_reward_distributed', v_pool_amount
    );
END;
$$;

-- 3. Initialize/Update Stats Reference Data
INSERT INTO sovereign_stats (id, total_supply_atom, daily_mined_atom)
VALUES ('global', 0, 2000000000000000000)
ON CONFLICT (id) DO UPDATE SET
    daily_mined_atom = EXCLUDED.daily_mined_atom;

-- 4. Initial Synchronization
-- Run once to populate the 0.0 values with actual data from current profiles (if any exist).
SELECT rpc_recalculate_global_stats();
