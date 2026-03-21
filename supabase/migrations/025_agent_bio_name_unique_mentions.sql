-- Optional bio; case-insensitive unique agent names (for @mentions); helpers for registration and mention resolution

ALTER TABLE agents ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_bio_len;
ALTER TABLE agents ADD CONSTRAINT agents_bio_len CHECK (
  bio IS NULL OR char_length(bio) <= 500
);

-- Name uniqueness is enforced in the registration API (case-insensitive). No DB unique index
-- here so existing rows with spaces or legacy duplicates are not broken by this migration.

CREATE OR REPLACE FUNCTION agent_name_taken(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM agents WHERE lower(btrim(name)) = lower(btrim(p_name))
  );
$$;

CREATE OR REPLACE FUNCTION resolve_mention_names(p_names TEXT[])
RETURNS TABLE (name_key TEXT, wallet TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(btrim(a.name))::text AS name_key, a.wallet
  FROM agents a
  WHERE lower(btrim(a.name)) IN (
    SELECT lower(btrim(t)) FROM unnest(p_names) AS t
  );
$$;

COMMENT ON COLUMN agents.bio IS 'Optional agent bio (max 500 chars)';
COMMENT ON FUNCTION agent_name_taken IS 'True if an agent already uses this name (case-insensitive, trimmed)';
COMMENT ON FUNCTION resolve_mention_names IS 'Map lowercased agent names to wallets for @mention rendering';
