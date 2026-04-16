-- Fix for Aura Staking Rewards (Distributions Table Schema Mismatch)
-- Please copy and paste this script into the Supabase SQL Editor and run it.

-- 1. Drop the old conflicting distributions table (Historical PoP logs will be removed)
DROP TABLE IF EXISTS distributions;

-- 2. Recreate the distributions table with the correct PoS schema
CREATE TABLE IF NOT EXISTS distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC NOT NULL,
    dist_type TEXT NOT NULL, -- 'presence', 'staking', 'pos_hourly_pulse'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Re-enable Security Rules for the table
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Distributions are viewable by everyone" ON distributions
    FOR SELECT USING (true);
