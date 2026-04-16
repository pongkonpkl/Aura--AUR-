-- Aura Sovereign Infrastructure: Bridge Rollback Protocol
-- This script MUST be run in the Supabase SQL Editor.

-- Creates a secure RPC function for the Oracle Relayer to refund failed Bridge Out transactions.
CREATE OR REPLACE FUNCTION rpc_bridge_refund(
    p_tx_id UUID,
    p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
    v_tx RECORD;
    v_asset TEXT;
    v_amount NUMERIC;
    v_wallet_address TEXT;
BEGIN
    -- 1. Lock the transaction row to prevent race conditions
    SELECT * INTO v_tx 
    FROM transactions 
    WHERE id = p_tx_id AND tx_type = 'bridge_out' AND status = 'pending' 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found or already processed');
    END IF;

    -- The asset type was temporarily stored in error_log by rpc_bridge_asset
    v_asset := v_tx.error_log;
    v_amount := v_tx.amount;
    v_wallet_address := v_tx.from_address;

    -- 2. Mark the transaction as failed
    UPDATE transactions 
    SET status = 'failed', error_log = 'Refunded: ' || p_reason, updated_at = NOW()
    WHERE id = p_tx_id;

    -- 3. Refund the balance back to the user
    IF v_asset = 'NATIVE' THEN
        UPDATE profiles SET native_balance = COALESCE(native_balance, 0) + v_amount WHERE wallet_address = LOWER(v_wallet_address);
    ELSIF v_asset = 'BTC' THEN
        UPDATE profiles SET btc_balance = COALESCE(btc_balance, 0) + v_amount WHERE wallet_address = LOWER(v_wallet_address);
    ELSIF v_asset = 'ETH' THEN
        UPDATE profiles SET eth_balance = COALESCE(eth_balance, 0) + v_amount WHERE wallet_address = LOWER(v_wallet_address);
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Refund completed successfully for ' || v_asset);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
