-- 🛡️ Aura Sovereign: Hardened Mining & Stats Protocol
-- Version: 1.2.0
-- Description: Implement Replay Protection, Access Control, and Atomic Global Stats.
-- This script provides a comprehensive security hardening for the live system.

-- 0. Cleanup existing functions
DROP FUNCTION IF EXISTS rpc_recalculate_global_stats();
DROP FUNCTION IF EXISTS rpc_submit_mining_share(text, uuid, text, text);
DROP FUNCTION IF EXISTS rpc_settle_mining_rewards();

-- 1. Security Infrastructure: Nonce Deduplication
-- This table prevents the same PoW solution from being submitted multiple times.
CREATE TABLE IF NOT EXISTS sovereign_mining_nonces (
    job_id UUID REFERENCES sovereign_mining_jobs(id),
    nonce TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (job_id, nonce)
);

-- 2. Helper: Recalculate Global Stats (Atomic Accuracy)
CREATE OR REPLACE FUNCTION rpc_recalculate_global_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_supply NUMERIC;
    v_daily_target NUMERIC := 2000000000000000000; -- 2.0 AUR (Hybrid Protocol)
BEGIN
    SELECT COALESCE(SUM(balance_atom::NUMERIC + staked_balance_atom::NUMERIC), 0)
    INTO v_total_supply
    FROM profiles;

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

-- 3. Hardened: Submit Mining Share (Replay Protected)
CREATE OR REPLACE FUNCTION rpc_submit_mining_share(
    p_user_address TEXT,
    p_job_id UUID,
    p_nonce TEXT,
    p_hash TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_seed TEXT;
    v_target TEXT;
    v_calculated_hash TEXT;
    v_job_active BOOLEAN;
    v_user_bytea BYTEA;
BEGIN
    -- [A] Standardization & Pre-checks
    v_user_bytea := decode(replace(lower(p_user_address), '0x', ''), 'hex');
    
    -- [B] Replay Protection: Check if nonce was already submitted for this job
    IF EXISTS (SELECT 1 FROM sovereign_mining_nonces WHERE job_id = p_job_id AND nonce = p_nonce) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Security Alert: Nonce already submitted for this job.');
    END IF;

    -- [C] Fetch Job Details
    SELECT seed, difficulty_target, is_active INTO v_seed, v_target, v_job_active
    FROM sovereign_mining_jobs WHERE id = p_job_id;
    
    IF NOT COALESCE(v_job_active, false) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job expired or inactive');
    END IF;
    
    -- [D] Validate Hash (Enforce lower() consistency for address string)
    v_calculated_hash := encode(digest(v_seed || lower(p_user_address) || p_nonce, 'sha256'), 'hex');
    
    IF v_calculated_hash <> lower(p_hash) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid hash calculation');
    END IF;
    
    IF v_calculated_hash > v_target THEN
        RETURN jsonb_build_object('success', false, 'error', 'Hash does not meet difficulty target');
    END IF;
    
    -- [E] Record Nonce (Atomic Lock) & Update Share
    INSERT INTO sovereign_mining_nonces (job_id, nonce) VALUES (p_job_id, p_nonce);
    
    UPDATE profiles 
    SET mining_shares = mining_shares + 1 
    WHERE address = v_user_bytea;
    
    RETURN jsonb_build_object('success', true, 'new_shares', (SELECT mining_shares FROM profiles WHERE address = v_user_bytea));
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Race Condition: Nonce accepted by another node.');
END;
$$;

-- 4. Hardened: Settle Mining Rewards (Access Controlled)
CREATE OR REPLACE FUNCTION rpc_settle_mining_rewards()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_shares BIGINT;
    v_pool_amount NUMERIC;
    v_reward_per_share NUMERIC;
    v_settled_count INTEGER := 0;
    v_old_job_id UUID;
BEGIN
    -- [A] Access Control: Only Service Role (Cloud Distributor) can settle rewards
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Security Violation: Manual settlement blocked. Access restricted to Cloud Distributor.';
    END IF;

    -- [B] Calculate Total Shares
    SELECT SUM(mining_shares) INTO v_total_shares FROM profiles WHERE mining_shares > 0;
    
    IF v_total_shares IS NULL OR v_total_shares = 0 THEN
        PERFORM rpc_recalculate_global_stats();
        RETURN jsonb_build_object('success', true, 'message', 'No shares to settle. Network stats synchronized.');
    END IF;
    
    -- [C] Get Hourly Pool
    SELECT (mining_pool_atom_daily / 24) INTO v_pool_amount FROM sovereign_stats WHERE id = 'global';
    v_reward_per_share := v_pool_amount / v_total_shares;
    
    -- [D] Distribute & Log to Activity Feed
    INSERT INTO transactions (tx_hash, from_address, to_address, amount, tx_type, signature, status, created_at)
    SELECT 
        'reward-' || encode(digest(p.address::text || now()::text || random()::text, 'sha256'), 'hex'),
        'System',
        '0x' || encode(p.address, 'hex'),
        (p.mining_shares * v_reward_per_share)::TEXT,
        'reward',
        'Protocol Consensus',
        'completed',
        NOW()
    FROM profiles p WHERE p.mining_shares > 0;

    -- Update Liquid Balances
    UPDATE profiles 
    SET 
        balance_atom = balance_atom + (mining_shares * v_reward_per_share),
        total_mined_atom = total_mined_atom + (mining_shares * v_reward_per_share),
        mining_shares = 0
    WHERE mining_shares > 0;
    
    GET DIAGNOSTICS v_settled_count = ROW_COUNT;
    
    -- [E] Rotate Seed
    SELECT id INTO v_old_job_id FROM sovereign_mining_jobs WHERE is_active = true ORDER BY created_at DESC LIMIT 1;
    UPDATE sovereign_mining_jobs SET is_active = false WHERE is_active = true;
    
    INSERT INTO sovereign_mining_jobs (seed, difficulty_target)
    VALUES (
        encode(digest(now()::text || random()::text, 'sha256'), 'hex'),
        (SELECT difficulty_target FROM sovereign_stats WHERE id = 'global')
    );
    
    -- [F] Cleanup: Remove nonces from previous jobs to save space
    DELETE FROM sovereign_mining_nonces WHERE job_id = v_old_job_id;
    
    -- [G] Global Synchronization
    PERFORM rpc_recalculate_global_stats();
    
    RETURN jsonb_build_object(
        'success', true, 
        'settled_wallets', v_settled_count, 
        'total_reward_distributed', v_pool_amount
    );
END;
$$;

-- 5. Initial Synchronization
INSERT INTO sovereign_stats (id, total_supply_atom, daily_mined_atom)
VALUES ('global', 0, 2000000000000000000)
ON CONFLICT (id) DO UPDATE SET daily_mined_atom = EXCLUDED.daily_mined_atom;

SELECT rpc_recalculate_global_stats();
