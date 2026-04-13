-- Aura Sovereign Infrastructure: Security Hardening (Atomic RPC)
-- This script MUST be run in the Supabase SQL Editor.

-- 1. Atomic Transfer Settlement
CREATE OR REPLACE FUNCTION rpc_settle_transfer(
    p_from_address TEXT,
    p_to_address TEXT,
    p_amount_atom NUMERIC,
    p_nonce BIGINT,
    p_tx_hash_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_from_id UUID;
    v_to_id UUID;
    v_current_balance NUMERIC;
    v_last_nonce BIGINT;
    v_burn_penalty NUMERIC;
    v_receive_amount NUMERIC;
BEGIN
    -- 1. Acquire sender lock and fetch state
    SELECT id, balance, last_nonce INTO v_from_id, v_current_balance, v_last_nonce 
    FROM profiles WHERE wallet_address = LOWER(p_from_address) FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sender profile not found');
    END IF;

    -- 2. Nonce Verification (Strict n+1)
    IF p_nonce <> (v_last_nonce + 1) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid nonce. Expected ' || (v_last_nonce + 1));
    END IF;

    -- 3. Balance Verification
    IF v_current_balance < p_amount_atom THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- 4. Calculate Burn (1% if >= 100 atoms)
    v_burn_penalty := CASE WHEN p_amount_atom >= 100 THEN FLOOR(p_amount_atom / 100) ELSE 0 END;
    v_receive_amount := p_amount_atom - v_burn_penalty;

    -- 5. Atomic Update: Sender
    UPDATE profiles 
    SET balance = balance - p_amount_atom, 
        last_nonce = p_nonce,
        updated_at = NOW()
    WHERE id = v_from_id;

    -- 6. Atomic Update: Receiver (Create if not exists)
    INSERT INTO profiles (wallet_address, balance)
    VALUES (LOWER(p_to_address), v_receive_amount)
    ON CONFLICT (wallet_address) DO UPDATE 
    SET balance = profiles.balance + v_receive_amount,
        updated_at = NOW();

    -- 7. Update Transaction Status
    UPDATE transactions 
    SET status = 'success', burn_penalty = v_burn_penalty
    WHERE id = p_tx_hash_id;

    RETURN jsonb_build_object('success', true, 'tx_hash', p_tx_hash_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic Staking Settlement
CREATE OR REPLACE FUNCTION rpc_settle_staking(
    p_op TEXT, -- 'stake' or 'unstake'
    p_address TEXT,
    p_amount_atom NUMERIC,
    p_nonce BIGINT,
    p_tx_hash_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_profile_id UUID;
    v_balance NUMERIC;
    v_staked NUMERIC;
    v_last_nonce BIGINT;
BEGIN
    -- 1. Lock profile
    SELECT id, balance, staked_balance, last_nonce 
    INTO v_profile_id, v_balance, v_staked, v_last_nonce 
    FROM profiles WHERE wallet_address = LOWER(p_address) FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    -- 2. Nonce Verification
    IF p_nonce <> (v_last_nonce + 1) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid nonce. Expected ' || (v_last_nonce + 1));
    END IF;

    -- 3. Logic based on op
    IF p_op = 'stake' THEN
        IF v_balance < p_amount_atom THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
        END IF;
        
        UPDATE profiles SET 
            balance = balance - p_amount_atom,
            staked_balance = staked_balance + p_amount_atom,
            last_nonce = p_nonce,
            updated_at = NOW()
        WHERE id = v_profile_id;

    ELSIF p_op = 'unstake' THEN
        IF v_staked < p_amount_atom THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient staked balance');
        END IF;

        UPDATE profiles SET 
            balance = balance + p_amount_atom,
            staked_balance = staked_balance - p_amount_atom,
            last_nonce = p_nonce,
            updated_at = NOW()
        WHERE id = v_profile_id;
    
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid operation');
    END IF;

    -- 4. Mark Transaction Success
    UPDATE transactions SET status = 'success' WHERE id = p_tx_hash_id;

    RETURN jsonb_build_object('success', true, 'tx_hash', p_tx_hash_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
