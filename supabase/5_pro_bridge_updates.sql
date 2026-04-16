-- Aura Sovereign Infrastructure: Pro Bridge Upgrades
-- This script MUST be run in the Supabase SQL Editor.

-- Update rpc_bridge_asset to return the Transaction ID for real-time tracking
CREATE OR REPLACE FUNCTION rpc_bridge_asset(
    p_wallet_address TEXT,
    p_asset TEXT, -- 'NATIVE', 'BTC', 'ETH'
    p_amount NUMERIC,
    p_is_deposit BOOLEAN,
    p_dest_address TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_profile_id UUID;
    v_native_balance NUMERIC;
    v_btc_balance NUMERIC;
    v_eth_balance NUMERIC;
    v_tx_type TEXT;
    v_tx_status TEXT;
    v_to_address TEXT;
    v_new_tx_id UUID;
BEGIN
    -- 1. Lock the profile row for atomic update
    SELECT id, native_balance, btc_balance, eth_balance 
    INTO v_profile_id, v_native_balance, v_btc_balance, v_eth_balance
    FROM profiles WHERE wallet_address = LOWER(p_wallet_address) FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    -- 2. Execute Asset Logic
    IF p_asset = 'NATIVE' THEN
        IF NOT p_is_deposit AND COALESCE(v_native_balance, 0) < p_amount THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient NATIVE balance');
        END IF;
        UPDATE profiles SET 
            native_balance = COALESCE(native_balance, 0) + (CASE WHEN p_is_deposit THEN p_amount ELSE -p_amount END),
            updated_at = NOW()
        WHERE id = v_profile_id;
    ELSIF p_asset = 'BTC' THEN
        IF NOT p_is_deposit AND COALESCE(v_btc_balance, 0) < p_amount THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient BTC balance');
        END IF;
        UPDATE profiles SET 
            btc_balance = COALESCE(btc_balance, 0) + (CASE WHEN p_is_deposit THEN p_amount ELSE -p_amount END),
            updated_at = NOW()
        WHERE id = v_profile_id;
    ELSIF p_asset = 'ETH' THEN
        IF NOT p_is_deposit AND COALESCE(v_eth_balance, 0) < p_amount THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient ETH balance');
        END IF;
        UPDATE profiles SET 
            eth_balance = COALESCE(eth_balance, 0) + (CASE WHEN p_is_deposit THEN p_amount ELSE -p_amount END),
            updated_at = NOW()
        WHERE id = v_profile_id;
    END IF;

    v_tx_type := CASE WHEN p_is_deposit THEN 'bridge_in' ELSE 'bridge_out' END;
    v_tx_status := CASE WHEN p_is_deposit THEN 'success' ELSE 'pending' END;

    IF p_is_deposit THEN
        v_to_address := LOWER(p_wallet_address);
    ELSE
        v_to_address := COALESCE(p_dest_address, 'OracleRelayer');
    END IF;

    -- 3. Insert and Return the ID
    INSERT INTO transactions (from_address, to_address, amount, tx_type, status, error_log)
    VALUES (
        CASE WHEN p_is_deposit THEN 'SovereignGateway' ELSE LOWER(p_wallet_address) END,
        v_to_address,
        p_amount, 
        v_tx_type, 
        v_tx_status,
        p_asset 
    ) RETURNING id INTO v_new_tx_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Asset Bridge Operation Queued',
        'tx_id', v_new_tx_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
