-- 🛡️ Aura Sovereign Miner: Database Architecture
-- This script sets up the sharding-compatible mining infrastructure for 1B wallets.

-- 1. Extend Profiles for Mining Effort
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS mining_shares BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_mined_atom NUMERIC DEFAULT 0;

-- 2. Update Sovereign Stats with Mining Metrics
-- Ensure the global stats row exists first
INSERT INTO sovereign_stats (id, total_supply_atom, daily_mined_atom)
VALUES ('global', '0', '1000000000000000000')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE sovereign_stats
ADD COLUMN IF NOT EXISTS mining_pool_atom_daily NUMERIC DEFAULT 1000000000000000000, -- 1 AUR/day
ADD COLUMN IF NOT EXISTS mining_difficulty_target TEXT DEFAULT '00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'; -- Initial easy target

-- 3. Create Mining Jobs Table (Seed Management)
CREATE TABLE IF NOT EXISTS sovereign_mining_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seed TEXT UNIQUE NOT NULL,
    difficulty_target TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT now() + interval '1 hour'
);

-- Index for high-speed job lookup
CREATE INDEX IF NOT EXISTS idx_mining_jobs_active ON sovereign_mining_jobs(is_active) WHERE is_active = true;

-- 4. RPC: Get Current Mining Job
CREATE OR REPLACE FUNCTION rpc_get_mining_job()
RETURNS TABLE (
    job_id UUID,
    seed TEXT,
    difficulty_target TEXT,
    user_shares BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_address TEXT;
BEGIN
    v_user_address := auth.jwt() ->> 'sub'; -- Usually UUID in Supabase Auth, but we use wallet address. 
    -- Note: If using Custom Wallet Identity, we might need a different way to identify the user.
    -- For now, we assume the caller provides their address in the RPC or it's inferred from session.
    
    RETURN QUERY
    SELECT 
        j.id, 
        j.seed, 
        j.difficulty_target,
        COALESCE(p.mining_shares, 0)
    FROM sovereign_mining_jobs j
    LEFT JOIN profiles p ON p.address = (SELECT address FROM profiles WHERE id::text = v_user_address LIMIT 1) -- Adjustment for sharding
    WHERE j.is_active = true
    ORDER BY j.created_at DESC
    LIMIT 1;
END;
$$;

-- 5. RPC: Submit Mining Share
-- This is the core PoW validation logic.
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
    -- 0. Standardize Address
    v_user_bytea := decode(replace(lower(p_user_address), '0x', ''), 'hex');

    -- 1. Fetch Job Details
    SELECT seed, difficulty_target, is_active INTO v_seed, v_target, v_job_active
    FROM sovereign_mining_jobs WHERE id = p_job_id;
    
    IF NOT v_job_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job expired or inactive');
    END IF;
    
    -- 2. Validate Hash (Server-side check)
    -- Logic: sha256(seed + p_user_address + nonce) 
    -- Note: We use the raw text p_user_address as passed (consistent with worker)
    v_calculated_hash := encode(digest(v_seed || p_user_address || p_nonce, 'sha256'), 'hex');
    
    IF v_calculated_hash <> p_hash THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid hash calculation');
    END IF;
    
    IF v_calculated_hash > v_target THEN
        RETURN jsonb_build_object('success', false, 'error', 'Hash does not meet difficulty target');
    END IF;
    
    -- 3. Record Share (Atomic update)
    UPDATE profiles 
    SET mining_shares = mining_shares + 1 
    WHERE address = v_user_bytea;
    
    RETURN jsonb_build_object('success', true, 'new_shares', (SELECT mining_shares FROM profiles WHERE address = v_user_bytea));
END;
$$;

-- 6. RPC: Settle Mining Rewards (Hourly Distribution)
CREATE OR REPLACE FUNCTION rpc_settle_mining_rewards()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_shares BIGINT;
    v_pool_amount NUMERIC;
    v_reward_per_share NUMERIC;
    v_settled_count INTEGER := 0;
BEGIN
    -- 1. Calculate Total Shares
    SELECT SUM(mining_shares) INTO v_total_shares FROM profiles WHERE mining_shares > 0;
    
    IF v_total_shares IS NULL OR v_total_shares = 0 THEN
        RETURN jsonb_build_object('success', true, 'message', 'No shares to settle');
    END IF;
    
    -- 2. Get Hourly Pool (Daily Pool / 24)
    SELECT (mining_pool_atom_daily / 24) INTO v_pool_amount FROM sovereign_stats WHERE id = 'global';
    
    v_reward_per_share := v_pool_amount / v_total_shares;
    
    -- 3. Distribute & Reset (Atomic Sharded Batch)
    -- Update balances and historical stats
    UPDATE profiles 
    SET 
        balance_atom = balance_atom + (mining_shares * v_reward_per_share),
        total_mined_atom = total_mined_atom + (mining_shares * v_reward_per_share),
        mining_shares = 0
    WHERE mining_shares > 0;
    
    GET DIAGNOSTICS v_settled_count = ROW_COUNT;
    
    -- 4. Rotate Seed for next epoch
    UPDATE sovereign_mining_jobs SET is_active = false WHERE is_active = true;
    INSERT INTO sovereign_mining_jobs (seed, difficulty_target)
    VALUES (
        encode(digest(now()::text || random()::text, 'sha256'), 'hex'),
        (SELECT difficulty_target FROM sovereign_stats WHERE id = 'global')
    );
    
    RETURN jsonb_build_object(
        'success', true, 
        'settled_wallets', v_settled_count, 
        'total_reward_distributed', v_pool_amount
    );
END;
$$;

-- Initialize first job
INSERT INTO sovereign_mining_jobs (seed, difficulty_target)
VALUES (
    'aura_genesis_seed_2026',
    '00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
) ON CONFLICT DO NOTHING;
