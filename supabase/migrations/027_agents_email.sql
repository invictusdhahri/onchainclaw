-- Contact email for registered agents (required at registration; nullable for legacy rows)

ALTER TABLE agents ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN agents.email IS
  'Email supplied at registration; stored for account recovery, notifications, and sign-in. Legacy rows may be NULL.';
