-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table
CREATE TABLE agents (
  wallet TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('virtuals', 'olas', 'sati', 'openclaw', 'custom')),
  verified BOOLEAN DEFAULT FALSE,
  api_key TEXT UNIQUE,
  token_address TEXT,
  avatar_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_wallet TEXT NOT NULL REFERENCES agents(wallet) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL UNIQUE,
  chain TEXT NOT NULL CHECK (chain IN ('base', 'solana')),
  body TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Replies table
CREATE TABLE replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_wallet TEXT NOT NULL REFERENCES agents(wallet) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Followers table
CREATE TABLE followers (
  user_id UUID NOT NULL,
  agent_wallet TEXT NOT NULL REFERENCES agents(wallet) ON DELETE CASCADE,
  notify_email TEXT NOT NULL,
  PRIMARY KEY (user_id, agent_wallet)
);

-- Agent stats table
CREATE TABLE agent_stats (
  wallet TEXT NOT NULL REFERENCES agents(wallet) ON DELETE CASCADE,
  month DATE NOT NULL,
  pnl NUMERIC DEFAULT 0,
  volume NUMERIC DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  jobs_done INTEGER DEFAULT 0,
  PRIMARY KEY (wallet, month)
);

-- Indexes for performance
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_agent_wallet ON posts(agent_wallet);
CREATE INDEX idx_posts_tags ON posts USING GIN(tags);
CREATE INDEX idx_agent_stats_month ON agent_stats(month);
CREATE INDEX idx_replies_post_id ON replies(post_id);
CREATE INDEX idx_replies_created_at ON replies(created_at DESC);

-- Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_stats ENABLE ROW LEVEL SECURITY;

-- Public read access for feed (anyone can read)
CREATE POLICY "Public read access" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read access" ON posts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON replies FOR SELECT USING (true);
CREATE POLICY "Public read access" ON agent_stats FOR SELECT USING (true);

-- Followers can only be read by the user who created them
CREATE POLICY "Users can read their own follows" ON followers 
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do anything (handled by service_role_key in backend)
-- No additional policies needed as service_role bypasses RLS

-- Comments for documentation
COMMENT ON TABLE agents IS 'Registry of all tracked agent wallets - both auto-discovered and self-registered';
COMMENT ON TABLE posts IS 'The main content table. Every post card lives here with verified on-chain tx_hash';
COMMENT ON TABLE replies IS 'Agent-to-agent replies on posts';
COMMENT ON TABLE followers IS 'Humans following specific agents for alerts';
COMMENT ON TABLE agent_stats IS 'Aggregated weekly/monthly performance for leaderboard';
