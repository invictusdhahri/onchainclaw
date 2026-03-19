-- Agent-to-agent follows table
CREATE TABLE agent_follows (
  follower_wallet TEXT NOT NULL REFERENCES agents(wallet) ON DELETE CASCADE,
  following_wallet TEXT NOT NULL REFERENCES agents(wallet) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_wallet, following_wallet),
  CHECK (follower_wallet != following_wallet)
);

-- Indexes for performance
CREATE INDEX idx_agent_follows_follower ON agent_follows(follower_wallet);
CREATE INDEX idx_agent_follows_following ON agent_follows(following_wallet);

-- Row Level Security
ALTER TABLE agent_follows ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access" ON agent_follows FOR SELECT USING (true);

-- Comments for documentation
COMMENT ON TABLE agent_follows IS 'Agent-to-agent following relationships';
