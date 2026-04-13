-- Aura Sovereign Infrastructure: Off-chain Settlement Schema
-- Primary state source for balances and transaction history

-- 1. Profiles: Authoritative State
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE NOT NULL,
    nickname TEXT,
    balance NUMERIC DEFAULT 0, -- Liquid balance in Atoms
    staked_balance NUMERIC DEFAULT 0, -- Staked balance in Atoms
    last_nonce BIGINT DEFAULT 0, -- Replay protection
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1b. Validators: Real-time Voting Power
CREATE TABLE IF NOT EXISTS validators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE NOT NULL REFERENCES profiles(wallet_address),
    voting_power NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validators_voting_power ON validators(voting_power DESC);

-- Index for wallet lookups
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address ON profiles(wallet_address);

-- 2. Transactions: Public Ledger (Data Availability)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash TEXT UNIQUE,
    from_address TEXT,
    to_address TEXT,
    amount NUMERIC NOT NULL,
    burn_penalty NUMERIC DEFAULT 0,
    tx_type TEXT NOT NULL, -- 'transfer', 'stake', 'unstake', 'reward', 'sync_legacy'
    status TEXT DEFAULT 'pending', -- 'pending' -> 'success' or 'failed'
    signature TEXT,
    payload JSONB, -- Stores the full request for the validator
    error_log TEXT, -- Stores failure reasons
    synced_to_github BOOLEAN DEFAULT false, -- Public Ledger Sync Flag
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for historical queries
CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions(to_address);

-- 3. Mining Logs: Proof of Presence Heartbeats
CREATE TABLE IF NOT EXISTS mining_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    wallet_address TEXT, -- Denormalized for speed
    hash_rate NUMERIC DEFAULT 1.0,
    earned_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Distributions: Global Ledger of Rewards
CREATE TABLE IF NOT EXISTS distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC NOT NULL,
    dist_type TEXT NOT NULL, -- 'presence', 'staking'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security: Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mining_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE validators ENABLE ROW LEVEL SECURITY;

-- Policies for Validators
CREATE POLICY "Validators are viewable by everyone" ON validators
    FOR SELECT USING (true);

CREATE POLICY "Service Role has full access to validators" ON validators
    FOR ALL USING (auth.role() = 'service_role');

-- Policies for Profiles
CREATE POLICY "Profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own nickname" ON profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Note: Balances can only be updated by the Service Role (Validator)
CREATE POLICY "Service Role has full access to profiles" ON profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Policies for Transactions
CREATE POLICY "Transactions are viewable by everyone" ON transactions
    FOR SELECT USING (true);

CREATE POLICY "Service Role has full access to transactions" ON transactions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can queue a transaction" ON transactions 
    FOR INSERT WITH CHECK (true);

-- Policies for Mining Logs
CREATE POLICY "Mining logs are viewable by everyone" ON mining_logs
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert heartbeats" ON mining_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for Distributions
CREATE POLICY "Distributions are viewable by everyone" ON distributions
    FOR SELECT USING (true);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
