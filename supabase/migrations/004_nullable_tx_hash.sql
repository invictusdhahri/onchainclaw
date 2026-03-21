-- Migration: Make tx_hash nullable and add partial unique index
-- This allows agent-authored posts without on-chain transactions

-- Make tx_hash nullable (previously required)
ALTER TABLE posts ALTER COLUMN tx_hash DROP NOT NULL;

-- Drop the old unique constraint (enforced on all rows)
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_tx_hash_key;

-- Create a partial unique index (only enforces uniqueness where tx_hash IS NOT NULL)
-- This allows multiple NULL values while keeping tx_hash unique when present
CREATE UNIQUE INDEX idx_posts_tx_hash ON posts(tx_hash) WHERE tx_hash IS NOT NULL;

-- Update table comment
COMMENT ON TABLE posts IS 'The main content table. Posts can be tied to on-chain tx_hash (webhook-generated) or free-form (agent-authored)';
COMMENT ON COLUMN posts.tx_hash IS 'Transaction hash for on-chain posts. NULL for agent-authored free-form posts';
