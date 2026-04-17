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

    -- 4. Update Validator Voting Power
    -- Create validator entry if it doesn't exist (Everyone is equal)
    INSERT INTO validators (wallet_address, voting_power)
    VALUES (LOWER(p_address), (SELECT staked_balance FROM profiles WHERE id = v_profile_id))
    ON CONFLICT (wallet_address) DO UPDATE 
    SET voting_power = EXCLUDED.voting_power,
        updated_at = NOW();

    -- 5. Mark Transaction Success
    UPDATE transactions SET status = 'success' WHERE id = p_tx_hash_id;

    RETURN jsonb_build_object('success', true, 'tx_hash', p_tx_hash_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atomic Periodic Reward Distribution (Professional PoS Pulse)
CREATE OR REPLACE FUNCTION rpc_distribute_rewards() 
RETURNS JSONB AS $$
DECLARE
    v_reward_per_sec NUMERIC := 11574074074074; -- 1 AUR / 86400 sec
    v_last_dist_time TIMESTAMP;
    v_seconds_elapsed NUMERIC;
    v_total_reward_atom NUMERIC;
    v_total_staked NUMERIC;
    v_dist_id UUID;
BEGIN
    -- Security: Only allow Service Role to trigger distribution
    IF auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Service Role required');
    END IF;

    -- 1. Fetch last STAKING distribution time specifically (BUG FIX: dist_type filter)
    SELECT created_at INTO v_last_dist_time 
    FROM distributions 
    WHERE dist_type = 'pos_hourly_pulse' 
    ORDER BY created_at DESC LIMIT 1;
    
    -- If no previous distribution, default to 1 hour ago
    IF v_last_dist_time IS NULL THEN
        v_seconds_elapsed := 3600;
    ELSE
        v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_last_dist_time));
    END IF;

    -- Safety Cap: Max 24 hours of rewards in one go
    v_seconds_elapsed := LEAST(v_seconds_elapsed, 86400);

    v_total_reward_atom := v_seconds_elapsed * v_reward_per_sec;

    -- 2. Identify total staked across the network
    SELECT COALESCE(sum(staked_balance), 0) INTO v_total_staked FROM profiles WHERE staked_balance > 0;

    -- 3. Distribute only if people are staking
    IF v_total_staked > 0 AND v_total_reward_atom > 0 THEN
        -- A: Update Profiles (UPGRADE: Auto-Compound into staked_balance instead of balance)
        UPDATE profiles
        SET staked_balance = staked_balance + FLOOR((staked_balance * v_total_reward_atom) / v_total_staked),
            updated_at = NOW()
        WHERE staked_balance > 0;
        
        -- B: Sync Validators (Update voting power to match new staked balance)
        UPDATE validators v
        SET voting_power = p.staked_balance,
            updated_at = NOW()
        FROM profiles p
        WHERE v.wallet_address = p.wallet_address
        AND p.staked_balance > 0;

        -- Log the successful distribution
        INSERT INTO distributions (amount, dist_type) 
        VALUES (v_total_reward_atom, 'pos_hourly_pulse')
        RETURNING id INTO v_dist_id;

        RETURN jsonb_build_object(
            'success', true, 
            'distribution_id', v_dist_id, 
            'total_aur_atoms_distributed', v_total_reward_atom,
            'total_aur_distributed', (v_total_reward_atom::NUMERIC / 1e18),
            'seconds_elapsed', v_seconds_elapsed,
            'recipients_count', (SELECT count(*) FROM profiles WHERE staked_balance > 0),
            'mode', 'auto-compounding'
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'No active stakers or zero time elapsed');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atomic Reward Increments
CREATE OR REPLACE FUNCTION increment_accumulated(user_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles SET balance = balance + amount, updated_at = NOW() WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_pending_stake(user_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles SET balance = balance + amount, updated_at = NOW() WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
