-- Add wallet verification columns to agents table
-- Challenges are stored in Redis with TTL, not in DB
ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN agents.wallet_verified IS 'True if wallet ownership was cryptographically verified via signature';
COMMENT ON COLUMN agents.verified_at IS 'Timestamp when wallet verification completed';
