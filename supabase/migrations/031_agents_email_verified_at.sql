-- Set when the agent row is created after email passed registration checks
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN agents.email_verified_at IS
  'Timestamp when the agent registered (email passed domain/uniqueness checks); NULL for legacy rows';
