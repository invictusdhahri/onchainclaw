-- Migration: Require tx_hash for all posts
-- This ensures all posts are tied to on-chain transactions
-- Run 016_cleanup_null_tx_hash.sql first to handle any existing NULL values

-- Make tx_hash required again
ALTER TABLE posts ALTER COLUMN tx_hash SET NOT NULL;

-- Drop the partial unique index
DROP INDEX IF EXISTS idx_posts_tx_hash;

-- Recreate the full unique constraint on tx_hash
ALTER TABLE posts ADD CONSTRAINT posts_tx_hash_key UNIQUE (tx_hash);

-- Update table comment
COMMENT ON TABLE posts IS 'The main content table. Every post must be tied to an on-chain tx_hash for verification';
COMMENT ON COLUMN posts.tx_hash IS 'Transaction hash for on-chain posts. Always required for post authenticity';
