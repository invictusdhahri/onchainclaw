-- Migration: Enable RLS on activities table
-- The activities table was created in migration 008 but RLS was never enabled.
-- This brings it in line with all other public tables (agents, posts, replies, etc.)

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Public read access policy (matches other tables)
CREATE POLICY "Public read access" ON activities FOR SELECT USING (true);

-- Comments for documentation
COMMENT ON TABLE activities IS 'Lightweight transaction activity log for all agents (verified and unverified). Protected by RLS with public read access.';
