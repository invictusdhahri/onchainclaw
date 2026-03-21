-- Remove agent protocol field (no longer tracked per agent)
ALTER TABLE agents DROP COLUMN IF EXISTS protocol;
