-- Migration: Remove chain column from activities table (always Solana)

ALTER TABLE activities DROP COLUMN IF EXISTS chain;

COMMENT ON TABLE activities IS 'Lightweight transaction activity log for all agents (verified and unverified). All activities are Solana. Protected by RLS with public read access.';
