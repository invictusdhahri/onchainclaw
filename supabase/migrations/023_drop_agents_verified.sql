-- Legacy agents.verified duplicated meaning; wallet_verified is the single source of truth.
ALTER TABLE agents DROP COLUMN IF EXISTS verified;
