-- Aura Sovereign Infrastructure: Multi-Vault Expansion
-- This script MUST be run in the Supabase SQL Editor.

-- 1. Add missing columns to the existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS native_balance NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS btc_balance NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS eth_balance NUMERIC DEFAULT 0;

-- 2. Create the Atomic Bridge Function
CREATE OR REPLACE FUNCTION rpc_bridge_asset(
    p_wallet_address TEXT,
    p_asset TEXT, -- 'NATIVE', 'BTC', 'ETH'
    p_amount NUMERIC,
    p_is_deposit BOOLEAN
) RETURNS JSONB AS $$
DECLARE
    v_profile_id UUID;
    v_native_balance NUMERIC;
    v_btc_balance NUMERIC;
    v_eth_balance NUMERIC;
BEGIN
    -- 1. Lock the profile row for atomic update
    SELECT id, native_balance, btc_balance, eth_balance 
    INTO v_profile_id, v_native_balance, v_btc_balance, v_eth_balance
    FROM profiles WHERE wallet_address = LOWER(p_wallet_address) FOR UPDATE;

    -- If profile somehow doesn't exist, this is an error (they should be registered via Fahsai)
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    -- Handle Fallback for old migrating accounts where properties might be null
    IF v_native_balance IS NULL THEN v_native_balance := 0; END IF;
    IF v_btc_balance IS NULL THEN v_btc_balance := 0; END IF;
    IF v_eth_balance IS NULL THEN v_eth_balance := 0; END IF;

    -- 2. Execute Asset Logic
    IF p_asset = 'NATIVE' THEN
        IF NOT p_is_deposit AND v_native_balance < p_amount THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient NATIVE balance');
        END IF;

        UPDATE profiles SET 
            native_balance = COALESCE(native_balance, 0) + (CASE WHEN p_is_deposit THEN p_amount ELSE -p_amount END),
            updated_at = NOW()
        WHERE id = v_profile_id;

    ELSIF p_asset = 'BTC' THEN
        IF NOT p_is_deposit AND v_btc_balance < p_amount THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient BTC balance');
        END IF;

        UPDATE profiles SET 
            btc_balance = COALESCE(btc_balance, 0) + (CASE WHEN p_is_deposit THEN p_amount ELSE -p_amount END),
            updated_at = NOW()
        WHERE id = v_profile_id;

    ELSIF p_asset = 'ETH' THEN
        IF NOT p_is_deposit AND v_eth_balance < p_amount THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient ETH balance');
        END IF;

        UPDATE profiles SET 
            eth_balance = COALESCE(eth_balance, 0) + (CASE WHEN p_is_deposit THEN p_amount ELSE -p_amount END),
            updated_at = NOW()
        WHERE id = v_profile_id;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Unsupported Asset');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Asset Bridge Operation Completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
