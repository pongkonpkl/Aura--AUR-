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

-- 2. Atomic Staking Settlement (Enterprise Accumulator Upgrade)
CREATE OR REPLACE FUNCTION _internal_harvest_individual(p_address TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_profile_id UUID;
    v_user_stake NUMERIC;
    v_user_last_index NUMERIC;
    v_global_index NUMERIC;
    v_pending_reward NUMERIC;
BEGIN
    SELECT id, staked_balance, last_reward_index 
    INTO v_profile_id, v_user_stake, v_user_last_index 
    FROM profiles WHERE wallet_address = LOWER(p_address) FOR UPDATE;

    IF NOT FOUND THEN RETURN 0; END IF;

    SELECT global_reward_index INTO v_global_index FROM network_state LIMIT 1;

    IF v_user_stake > 0 AND v_global_index > v_user_last_index THEN
        v_pending_reward := FLOOR(v_user_stake * (v_global_index - v_user_last_index));
        
        IF v_pending_reward > 0 THEN
            UPDATE profiles SET 
                staked_balance = staked_balance + v_pending_reward,
                last_reward_index = v_global_index,
                updated_at = NOW()
            WHERE id = v_profile_id;

            UPDATE validators SET 
                voting_power = voting_power + v_pending_reward,
                updated_at = NOW()
            WHERE wallet_address = LOWER(p_address);
            
            RETURN v_pending_reward;
        END IF;
    END IF;

    UPDATE profiles SET last_reward_index = v_global_index WHERE id = v_profile_id;
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    v_harvested NUMERIC;
BEGIN
    -- 1. Harvest Rewards FIRST (Auto-Compounding Event)
    v_harvested := _internal_harvest_individual(p_address);

    -- 2. Lock & Settle the Transaction
    SELECT id, balance, staked_balance, last_nonce 
    INTO v_profile_id, v_balance, v_staked, v_last_nonce 
    FROM profiles WHERE wallet_address = LOWER(p_address) FOR UPDATE;

    IF p_nonce <> (v_last_nonce + 1) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid nonce');
    END IF;

    IF p_op = 'stake' THEN
        IF v_balance < p_amount_atom THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance'); END IF;
        
        UPDATE profiles SET 
            balance = balance - p_amount_atom,
            staked_balance = staked_balance + p_amount_atom,
            last_nonce = p_nonce
        WHERE id = v_profile_id;
        
        UPDATE network_state SET total_staked_global = total_staked_global + p_amount_atom;

    ELSIF p_op = 'unstake' THEN
        IF v_staked < p_amount_atom THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient stake'); END IF;

        UPDATE profiles SET 
            balance = balance + p_amount_atom,
            staked_balance = staked_balance - p_amount_atom,
            last_nonce = p_nonce
        WHERE id = v_profile_id;

        UPDATE network_state SET total_staked_global = total_staked_global - p_amount_atom;
    END IF;

    INSERT INTO validators (wallet_address, voting_power)
    VALUES (LOWER(p_address), (SELECT staked_balance FROM profiles WHERE id = v_profile_id))
    ON CONFLICT (wallet_address) DO UPDATE SET voting_power = EXCLUDED.voting_power;

    UPDATE transactions SET status = 'success' WHERE id = p_tx_hash_id;

    RETURN jsonb_build_object('success', true, 'harvested_on_sync', v_harvested);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enterprise Distribution (O(1) Complexity)
CREATE OR REPLACE FUNCTION rpc_distribute_rewards() 
RETURNS JSONB AS $$
DECLARE
    v_reward_per_sec NUMERIC := 11574074.074074074074074; -- 1 AUR / 86400 sec (Atoms)
    v_last_time TIMESTAMPTZ;
    v_current_index NUMERIC;
    v_total_staked NUMERIC;
    v_seconds_elapsed NUMERIC;
    v_total_reward_atom NUMERIC;
    v_index_delta NUMERIC;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT last_dist_time, global_reward_index, total_staked_global 
    INTO v_last_time, v_current_index, v_total_staked 
    FROM network_state FOR UPDATE LIMIT 1;

    v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_last_time));
    v_seconds_elapsed := LEAST(v_seconds_elapsed, 86400);

    IF v_seconds_elapsed < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Too early');
    END IF;

    v_total_reward_atom := v_seconds_elapsed * v_reward_per_sec;

    IF v_total_staked > 0 THEN
        v_index_delta := v_total_reward_atom / v_total_staked;
        
        UPDATE network_state SET 
            global_reward_index = global_reward_index + v_index_delta,
            last_dist_time = NOW(),
            updated_at = NOW();
            
        INSERT INTO distributions (amount, dist_type) 
        VALUES (v_total_reward_atom, 'enterprise_pulse_v3');

        RETURN jsonb_build_object(
            'success', true, 
            'mode', 'enterprise-accumulator',
            'index_delta', v_index_delta,
            'total_reward_pool_atoms', v_total_reward_atom
        );
    ELSE
        UPDATE network_state SET last_dist_time = NOW() WHERE true;
        RETURN jsonb_build_object('success', false, 'error', 'No active stakers');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enterprise View: Get Virtual Stake
CREATE OR REPLACE FUNCTION rpc_get_stake_summary(p_address TEXT)
RETURNS JSONB AS $$
DECLARE
    v_stake NUMERIC;
    v_last_idx NUMERIC;
    v_global_idx NUMERIC;
    v_virtual_reward NUMERIC;
BEGIN
    SELECT staked_balance, last_reward_index INTO v_stake, v_last_idx 
    FROM profiles WHERE wallet_address = LOWER(p_address);
    
    SELECT global_reward_index INTO v_global_idx FROM network_state LIMIT 1;

    v_virtual_reward := FLOOR(v_stake * (v_global_idx - v_last_idx));

    RETURN jsonb_build_object(
        'address', p_address,
        'staked_balance_db', v_stake,
        'pending_reward_virtual', v_virtual_reward,
        'total_compounded_estimated', v_stake + v_virtual_reward
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atomic Reward Increments (Legacy Support)
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
