-- 🏰 Aura Sovereign: Staking & Consensus Settlement Protocol
-- Version: 1.3.0
-- Description: Implements atomic staking settlement and secure P2P transfers.

-- 0. Deep Cleanup: Remove all possible legacy conflict variants
DROP FUNCTION IF EXISTS rpc_settle_staking(text, text, numeric, bigint, uuid);
DROP FUNCTION IF EXISTS rpc_settle_staking(text, text, text, integer, uuid);
DROP FUNCTION IF EXISTS rpc_settle_staking(text, text, numeric, bigint, text);
DROP FUNCTION IF EXISTS rpc_settle_transfer(text, text, numeric, bigint, uuid);
DROP FUNCTION IF EXISTS rpc_settle_transfer(text, text, text, integer, uuid);

-- 1. Atomic Staking Settlement
CREATE OR REPLACE FUNCTION rpc_settle_staking(
    p_op TEXT,
    p_address TEXT,
    p_amount_atom NUMERIC,
    p_nonce BIGINT,
    p_tx_hash_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_bytea BYTEA;
    v_current_balance NUMERIC;
    v_current_staked NUMERIC;
    v_current_nonce BIGINT;
BEGIN
    -- [A] Input Validation
    v_user_bytea := decode(replace(lower(p_address), '0x', ''), 'hex');
    
    SELECT balance_atom, staked_balance_atom, last_nonce 
    INTO v_current_balance, v_current_staked, v_current_nonce
    FROM profiles WHERE address = v_user_bytea;
    
    IF v_current_nonce IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Identity not found in ledger.');
    END IF;

    -- [B] Anti-Replay Nonce Check
    IF p_nonce <= v_current_nonce THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nonce conflict: Transaction already processed.');
    END IF;

    -- [C] Operation Execution
    IF p_op = 'stake' THEN
        IF v_current_balance < p_amount_atom THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient liquid balance for vault allocation.');
        END IF;
        
        UPDATE profiles SET 
            balance_atom = balance_atom - p_amount_atom,
            staked_balance_atom = staked_balance_atom + p_amount_atom,
            last_nonce = p_nonce
        WHERE address = v_user_bytea;
        
    ELSIF p_op = 'unstake' THEN
        IF v_current_staked < p_amount_atom THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient staked balance in vault.');
        END IF;
        
        UPDATE profiles SET 
            balance_atom = balance_atom + p_amount_atom,
            staked_balance_atom = staked_balance_atom - p_amount_atom,
            last_nonce = p_nonce
        WHERE address = v_user_bytea;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid staking operation.');
    END IF;

    -- [D] Record Final Status
    -- Flexible lookup: Match by either UUID id or text tx_hash to ensure success update
    UPDATE transactions 
    SET status = 'success' 
    WHERE id = p_tx_hash_id OR tx_hash = p_tx_hash_id::text;

    RETURN jsonb_build_object('success', true, 'new_balance', v_current_balance, 'new_staked', v_current_staked);
END;
$$;

-- 2. Atomic P2P Transfer Settlement
CREATE OR REPLACE FUNCTION rpc_settle_transfer(
    p_from_address TEXT,
    p_to_address TEXT,
    p_amount_atom NUMERIC,
    p_nonce BIGINT,
    p_tx_hash_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_from_bytea BYTEA;
    v_to_bytea BYTEA;
    v_from_balance NUMERIC;
    v_from_nonce BIGINT;
BEGIN
    v_from_bytea := decode(replace(lower(p_from_address), '0x', ''), 'hex');
    v_to_bytea := decode(replace(lower(p_to_address), '0x', ''), 'hex');

    SELECT balance_atom, last_nonce INTO v_from_balance, v_from_nonce
    FROM profiles WHERE address = v_from_bytea;

    IF p_nonce <= v_from_nonce THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nonce conflict.');
    END IF;

    IF v_from_balance < p_amount_atom THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds.');
    END IF;

    -- Atomic Swap
    UPDATE profiles SET balance_atom = balance_atom - p_amount_atom, last_nonce = p_nonce WHERE address = v_from_bytea;
    UPDATE profiles SET balance_atom = balance_atom + p_amount_atom WHERE address = v_to_bytea;

    -- Auto-onboard recipient if they don't exist
    IF NOT FOUND THEN
        INSERT INTO profiles (address, balance_atom, staked_balance_atom) VALUES (v_to_bytea, p_amount_atom, 0);
    END IF;

    UPDATE transactions SET status = 'success' WHERE id = p_tx_hash_id OR tx_hash = p_tx_hash_id::text;

    RETURN jsonb_build_object('success', true);
END;
$$;
