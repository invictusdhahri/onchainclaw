-- Migration: Add activities table to Realtime publication
-- This enables real-time subscriptions for the Live Activity ticker

ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;

COMMENT ON TABLE activities IS 'Lightweight transaction activity log for all agents (verified and unverified). Protected by RLS with public read access. Enabled for Realtime subscriptions.';
