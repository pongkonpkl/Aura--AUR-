-- Aura Sovereign Infrastructure: Quantum Swap Protocol (v1)
-- AMM logic for AUR -> NATIVE exchange with 1% protocol burn.
-- Designed for 100M units and atomic settlement.
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION rpc_settle_swap(
    p_user_address TEXT,
    p_amount_aur_atom NUMERIC,
    p_target_asset TEXT, -- Expected 'NATIVE'
    p_nonce BIGINT,
    p_tx_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_profile_id UUID;
    v_current_aur NUMERIC;
    v_last_nonce BIGINT;
    v_burn_amount NUMERIC;
    v_effective_swap NUMERIC;
    v_native_output NUMERIC;
    v_rate NUMERIC := 10.0; -- 1 AUR = 10 NATIVE
BEGIN
    -- 1. Security Check: Service Role Only
    IF auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- 2. Acquire Atomic Lock
    SELECT id, balance, last_nonce INTO v_profile_id, v_current_aur, v_last_nonce 
    FROM profiles WHERE wallet_address = LOWER(p_user_address) FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    -- 3. Nonce Verification
    IF p_nonce <> (v_last_nonce + 1) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid nonce. Expected ' || (v_last_nonce + 1));
    END IF;

    -- 4. Balance Verification
    IF v_current_aur < p_amount_aur_atom THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient AUR balance');
    END IF;

    -- 5. Quantum Math: 1% Burn Fee + High-Security Asset Conversion
    v_burn_amount := FLOOR(p_amount_aur_atom * 0.01);
    v_effective_swap := p_amount_aur_atom - v_burn_amount;
    
    -- Calculation: (Atoms / 10^18) * Rate
    v_native_output := (v_effective_swap / 1000000000000000000.0) * v_rate;

    -- 6. Atomic Settlement (The Sovereign Sink)
    IF p_target_asset = 'BTC' THEN
        UPDATE profiles SET 
            balance = balance - p_amount_aur_atom,
            btc_balance = COALESCE(btc_balance, 0) + v_native_output,
            last_nonce = p_nonce,
            updated_at = NOW()
        WHERE id = v_profile_id;
    ELSIF p_target_asset = 'ETH' THEN
        UPDATE profiles SET 
            balance = balance - p_amount_aur_atom,
            eth_balance = COALESCE(eth_balance, 0) + v_native_output,
            last_nonce = p_nonce,
            updated_at = NOW()
        WHERE id = v_profile_id;
    ELSE -- Default to NATIVE
        UPDATE profiles SET 
            balance = balance - p_amount_aur_atom,
            native_balance = COALESCE(native_balance, 0) + v_native_output,
            last_nonce = p_nonce,
            updated_at = NOW()
        WHERE id = v_profile_id;
    END IF;

    -- Deflationary Action: Burn the AUR from Global Supply
    UPDATE network_state SET 
        total_supply_global = total_supply_global - p_amount_aur_atom 
    WHERE true;

    -- 7. Log to Public Ledger
    UPDATE transactions SET 
        status = 'success',
        burn_penalty = v_burn_amount,
        payload = jsonb_build_object(
            'swap_type', 'quantum_amm',
            'input_aur_atoms', p_amount_aur_atom,
            'output_native', v_native_output,
            'rate', v_rate
        )
    WHERE id = p_tx_id;

    RETURN jsonb_build_object(
        'success', true, 
        'burn_incinerated_atoms', v_burn_amount,
        'native_credited', v_native_output,
        'tx_id', p_tx_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
