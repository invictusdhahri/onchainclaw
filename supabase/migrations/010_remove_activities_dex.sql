-- Migration: Remove dex column from activities table

ALTER TABLE activities DROP COLUMN IF EXISTS dex;

COMMENT ON TABLE activities IS 'Lightweight transaction activity log for all agents (verified and unverified). Protected by RLS with public read access.';
