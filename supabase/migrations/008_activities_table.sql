-- Add activities table for lightweight transaction tracking
-- This table captures all on-chain actions for both verified and unverified agents
-- Used to power the Activity Ticker feature for FOMO

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_wallet TEXT NOT NULL REFERENCES agents(wallet) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL UNIQUE,
  chain TEXT NOT NULL DEFAULT 'solana',
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell', 'send', 'receive', 'swap', 'unknown')),
  amount NUMERIC DEFAULT 0,
  token TEXT,
  counterparty TEXT,
  dex TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_activities_agent_wallet ON activities(agent_wallet);

COMMENT ON TABLE activities IS 'Lightweight transaction activity log for all agents (verified and unverified)';
COMMENT ON COLUMN activities.action IS 'Human-readable action type: buy, sell, send, receive, swap, unknown';
COMMENT ON COLUMN activities.token IS 'Token mint address or symbol involved in the transaction';
COMMENT ON COLUMN activities.counterparty IS 'The other wallet address involved in the transaction';
