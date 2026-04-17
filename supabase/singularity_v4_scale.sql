-- Aura Sovereign Infrastructure: Singularity Scale Upgrade (v4)
-- Designed for 100 Million Users and High-Throughput L2 Settlement
-- Run this in the Supabase SQL Editor.

-- 1. Cold Storage (Archive)
CREATE TABLE IF NOT EXISTS archive_transactions (
    LIKE transactions INCLUDING ALL
);

-- 2. Pruning Logic (O(1) Active Ledger size)
CREATE OR REPLACE FUNCTION rpc_prune_ledger(p_days_to_keep INTEGER DEFAULT 7)
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Security: Service Role ONLY
    IF auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- 1. Identify and Move old records (Transactions)
    WITH moved_rows AS (
        DELETE FROM transactions
        WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL
        RETURNING *
    )
    INSERT INTO archive_transactions SELECT * FROM moved_rows;

    -- 2. Clean Mining Logs (High frequency table)
    DELETE FROM mining_logs
    WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;

    -- 3. Refresh Rankings (For Read Optimization)
    PERFORM refresh_validator_rankings();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true, 
        'pruned_count', v_count, 
        'archive_status', 'Cold Storage Synchronized',
        'retention_policy', p_days_to_keep || ' days'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. High-Throughput Batch Settlement (L2 Rollup Style)
-- Accepts an array of transaction operations to process in a single atomic block.
CREATE OR REPLACE FUNCTION rpc_settle_batch(
    p_transactions JSONB -- Array of {op, from, to, amount, nonce, tx_id}
) RETURNS JSONB AS $$
DECLARE
    v_tx RECORD;
    v_results JSONB := '[]'::jsonb;
    v_success_count INTEGER := 0;
    v_fail_count INTEGER := 0;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    FOR v_tx IN SELECT * FROM jsonb_array_elements(p_transactions)
    LOOP
        BEGIN
            -- Determine OP and call appropriate logic
            -- (Reusing existing settled logic for consistency, but grouped in one TX)
            
            IF (v_tx.value->>'op') = 'transfer' THEN
                PERFORM rpc_settle_transfer(
                    v_tx.value->>'from',
                    v_tx.value->>'to',
                    (v_tx.value->>'amount')::NUMERIC,
                    (v_tx.value->>'nonce')::BIGINT,
                    (v_tx.value->>'tx_id')::UUID
                );
            ELSIF (v_tx.value->>'op') IN ('stake', 'unstake') THEN
                PERFORM rpc_settle_staking(
                    v_tx.value->>'op',
                    v_tx.value->>'from',
                    (v_tx.value->>'amount')::NUMERIC,
                    (v_tx.value->>'nonce')::BIGINT,
                    (v_tx.value->>'tx_id')::UUID
                );
            END IF;

            v_success_count := v_success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            v_fail_count := v_fail_count + 1;
            v_results := v_results || jsonb_build_object('tx_id', v_tx.value->>'tx_id', 'error', SQLERRM);
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'processed', v_success_count,
        'failed', v_fail_count,
        'errors', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Materialized View for Read Optimization (Validator Rankings)
-- For 100M users, sorting the entire table real-time is too expensive.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_validator_rankings AS
SELECT 
    wallet_address,
    voting_power,
    updated_at
FROM validators
ORDER BY voting_power DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_validator_wallet ON mv_validator_rankings(wallet_address);

-- Refresh Function (To be called by a trigger or cron)
CREATE OR REPLACE FUNCTION refresh_validator_rankings()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_validator_rankings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Enterprise Cached Stats RPC
CREATE OR REPLACE FUNCTION rpc_get_cached_stats()
RETURNS JSONB AS $$
DECLARE
    v_total_supply NUMERIC;
    v_total_staked NUMERIC;
    v_active_nodes INTEGER;
BEGIN
    SELECT total_supply_global, total_staked_global INTO v_total_supply, v_total_staked FROM network_state LIMIT 1;
    SELECT count(*) INTO v_active_nodes FROM mv_validator_rankings;

    RETURN jsonb_build_object(
        'total_supply', v_total_supply,
        'total_staked', v_total_staked,
        'active_nodes', v_active_nodes,
        'cache_status', 'Singularity Layer Optimized'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;