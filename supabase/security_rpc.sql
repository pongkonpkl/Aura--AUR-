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

-- 3. Atomic Daily Reward Distribution
CREATE OR REPLACE FUNCTION rpc_distribute_rewards() 
RETURNS JSONB AS $$
DECLARE
    v_total_reward_atom NUMERIC := 1000000000000000000; -- 1 AUR
    v_pop_share NUMERIC := 0.8; -- 80% Presence
    v_pos_share NUMERIC := 0.2; -- 20% Staking
    v_active_nodes_count INT;
    v_total_staked NUMERIC;
    v_reward_per_node NUMERIC;
    v_dist_id UUID;
BEGIN
    -- 1. Identify active nodes (PoP) - users with heartbeats in last 24h
    SELECT count(*) INTO v_active_nodes_count FROM mining_logs WHERE created_at > NOW() - INTERVAL '24 hours';
    
    -- 2. Identify total staked (PoS)
    SELECT sum(staked_balance) INTO v_total_staked FROM profiles WHERE staked_balance > 0;

    -- 3. Distribute PoP (80%)
    IF v_active_nodes_count > 0 THEN
        v_reward_per_node := (v_total_reward_atom * v_pop_share) / v_active_nodes_count;
        
        -- Add to balance of active nodes
        UPDATE profiles p
        SET balance = balance + v_reward_per_node,
            updated_at = NOW()
        FROM mining_logs m
        WHERE p.id = m.user_id AND m.created_at > NOW() - INTERVAL '24 hours';
    END IF;

    -- 4. Distribute PoS (20%)
    IF v_total_staked > 0 THEN
        -- Add proportional to stake
        UPDATE profiles
        SET balance = balance + ((staked_balance / v_total_staked) * (v_total_reward_atom * v_pos_share)),
            updated_at = NOW()
        WHERE staked_balance > 0;
    END IF;

    -- 5. Log Distribution
    INSERT INTO distributions (amount, dist_type) 
    VALUES (v_total_reward_atom, 'hybrid_pos_pop')
    RETURNING id INTO v_dist_id;

    RETURN jsonb_build_object('success', true, 'distribution_id', v_dist_id, 'total_aur', 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
