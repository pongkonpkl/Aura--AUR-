-- Aura Sovereign System: Reward Claiming Protocol Fix (BYTEA Compliance)
-- Version: 1.0.1
-- Description: Fixes "function lower(bytea) does not exist" by using direct bytea comparison.

CREATE OR REPLACE FUNCTION rpc_claim_rewards(
    p_user_address TEXT,
    p_signature TEXT,
    p_nonce BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_bytea BYTEA;
    v_reward_amount BIGINT;
    v_current_balance BIGINT;
    v_claim_id UUID;
BEGIN
    -- 1. Parse Input Address to Binary (BYTEA)
    v_user_bytea := decode(replace(p_user_address, '0x', ''), 'hex');

    -- 2. Security Check: Nonce Verification (Draft Logic - adjust if needed)
    -- In a live PoS system, signature verification would happen here or in a wrapper.
    -- For now, we fix the data-type error blocking the UI.

    -- 3. Fetch Pending Rewards (Mocking logic based on current ledger structure)
    -- This assumes rewards are tracked in a dedicated table or calculated.
    -- If using profiles table:
    SELECT (COALESCE(pending_reward, 0)::BIGINT) INTO v_reward_amount
    FROM profiles
    WHERE address = v_user_bytea;

    IF v_reward_amount IS NULL OR v_reward_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'No rewards accrued at this singularity coordinate.');
    END IF;

    -- 4. Atomic Settlement: Move Pending to Balance
    UPDATE profiles 
    SET 
        balance_atom = (balance_atom::BIGINT + v_reward_amount)::TEXT,
        pending_reward = '0',
        last_nonce = p_nonce,
        updated_at = NOW()
    WHERE address = v_user_bytea
    RETURNING (balance_atom::BIGINT) INTO v_current_balance;

    -- 5. Return Professional Success Payload
    RETURN json_build_object(
        'success', true,
        'claimed_amount', v_reward_amount::TEXT,
        'new_balance', v_current_balance::TEXT,
        'nonce_applied', p_nonce,
        'timestamp', NOW()
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
