-- 🛡️ Aura Sovereign Core: Stability & Sync Protocol
-- Version: 1.1.1
-- Description: Fixes hex parsing bugs and implements missing heartbeats/profile RPCs.

-- 0. Cleanup existing functions to prevent return type mismatch errors
DROP FUNCTION IF EXISTS rpc_get_profile(text);
DROP FUNCTION IF EXISTS rpc_get_ledger(text, int);
DROP FUNCTION IF EXISTS rpc_log_pulse(text);
DROP FUNCTION IF EXISTS rpc_check_identity(text);
DROP FUNCTION IF EXISTS rpc_claim_rewards(text, text, bigint);

-- 1. Schema Hardening
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_nonce BIGINT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS balance_atom NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS staked_balance_atom NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pending_reward NUMERIC DEFAULT 0;

-- 2. Core RPC: Get Profile (Fixed for Hex Length Compliance)
CREATE OR REPLACE FUNCTION rpc_get_profile(p_user_address TEXT)
RETURNS TABLE (
    address_text TEXT,
    balance_atom NUMERIC,
    staked_balance_atom NUMERIC,
    last_nonce BIGINT,
    nickname TEXT,
    mining_shares BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_bytea BYTEA;
BEGIN
    -- Safe Hex Parsing: Replace 0x only, avoid LTRIM stripping actual address digits
    v_user_bytea := decode(replace(lower(p_user_address), '0x', ''), 'hex');
    
    RETURN QUERY
    SELECT 
        '0x' || encode(address, 'hex'),
        profiles.balance_atom,
        profiles.staked_balance_atom,
        profiles.last_nonce,
        profiles.nickname,
        COALESCE(profiles.mining_shares, 0)
    FROM profiles
    WHERE address = v_user_bytea
    LIMIT 1;
END;
$$;

-- 3. Core RPC: Log Pulse (Missing Heartbeat Function)
CREATE OR REPLACE FUNCTION rpc_log_pulse(p_user_address TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_bytea BYTEA;
BEGIN
    v_user_bytea := decode(replace(lower(p_user_address), '0x', ''), 'hex');
    
    UPDATE profiles 
    SET last_seen = NOW() 
    WHERE address = v_user_bytea;
    
    IF NOT FOUND THEN
        -- Auto-register if pulse from new sovereign identity
        INSERT INTO profiles (address, balance_atom, staked_balance_atom)
        VALUES (v_user_bytea, 0, 0);
    END IF;
    
    RETURN jsonb_build_object('success', true, 'timestamp', NOW());
END;
$$;

-- 4. Core RPC: Check Identity
CREATE OR REPLACE FUNCTION rpc_check_identity(p_target_address TEXT)
RETURNS TABLE (
    is_valid BOOLEAN,
    nickname TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_target_bytea BYTEA;
BEGIN
    IF p_target_address IS NULL OR length(replace(p_target_address, '0x', '')) != 40 THEN
        RETURN QUERY SELECT false, NULL::TEXT;
        RETURN;
    END IF;

    v_target_bytea := decode(replace(lower(p_target_address), '0x', ''), 'hex');
    
    RETURN QUERY
    SELECT 
        true,
        profiles.nickname
    FROM profiles
    WHERE address = v_target_bytea
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::TEXT;
    END IF;
END;
$$;

-- 5. Core RPC: Get Ledger (History)
CREATE OR REPLACE FUNCTION rpc_get_ledger(p_user_address TEXT, p_limit INT DEFAULT 15)
RETURNS TABLE (
    id BIGINT,
    tx_hash TEXT,
    from_address TEXT,
    to_address TEXT,
    amount NUMERIC,
    tx_type TEXT,
    status TEXT,
    created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_bytea BYTEA;
BEGIN
    v_user_bytea := decode(replace(lower(p_user_address), '0x', ''), 'hex');
    
    RETURN QUERY
    SELECT 
        t.id,
        t.tx_hash,
        '0x' || encode(t.from_address, 'hex'),
        '0x' || encode(t.to_address, 'hex'),
        t.amount,
        t.tx_type,
        t.status,
        t.created_at
    FROM transactions t
    WHERE t.from_address = v_user_bytea OR t.to_address = v_user_bytea
    ORDER BY t.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 6. Repair: Claim Rewards (Fixed Hex Parsing)
CREATE OR REPLACE FUNCTION rpc_claim_rewards(
    p_user_address TEXT,
    p_signature TEXT,
    p_nonce BIGINT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_bytea BYTEA;
    v_accrued_amt NUMERIC;
BEGIN
    v_user_bytea := decode(replace(lower(p_user_address), '0x', ''), 'hex');
    
    -- Fetch Accrual (Matches reward_protocol_v1 logic but fixed hex)
    SELECT COALESCE(reward_accrual_atom, '0')::NUMERIC INTO v_accrued_amt 
    FROM profiles 
    WHERE address = v_user_bytea;

    IF v_accrued_amt IS NULL OR v_accrued_amt <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No rewards available to claim.');
    END IF;

    -- Move accrued to liquid balance
    UPDATE profiles SET 
        balance_atom = balance_atom + v_accrued_amt,
        reward_accrual_atom = '0',
        last_nonce = p_nonce
    WHERE address = v_user_bytea;

    RETURN jsonb_build_object('success', true, 'claimed_amount', v_accrued_amt);
END;
$$;
