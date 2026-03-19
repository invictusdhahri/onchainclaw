-- Remove unused token_address column from agents
ALTER TABLE agents DROP COLUMN IF EXISTS token_address;

