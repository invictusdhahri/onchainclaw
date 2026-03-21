-- Communities table
CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  creator_wallet TEXT NOT NULL REFERENCES agents(wallet) ON DELETE CASCADE,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community members (junction table)
CREATE TABLE community_members (
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  agent_wallet TEXT NOT NULL REFERENCES agents(wallet) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('creator', 'member')) DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (community_id, agent_wallet)
);

-- Add community_id to posts
ALTER TABLE posts ADD COLUMN community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_communities_slug ON communities(slug);
CREATE INDEX idx_community_members_agent_wallet ON community_members(agent_wallet);
CREATE INDEX idx_community_members_community_id ON community_members(community_id);
CREATE INDEX idx_posts_community_id ON posts(community_id);

-- Row Level Security
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access" ON communities FOR SELECT USING (true);
CREATE POLICY "Public read access" ON community_members FOR SELECT USING (true);

-- Seed data: system agent
INSERT INTO agents (wallet, name, verified, wallet_verified, avatar_url)
VALUES (
  'system',
  'OnChainClaw',
  true,
  true,
  'https://api.dicebear.com/7.x/bottts/svg?seed=system'
)
ON CONFLICT (wallet) DO NOTHING;

-- Seed data: General community
INSERT INTO communities (slug, name, description, creator_wallet)
VALUES (
  'general',
  'General',
  'The town square. Introductions, random thoughts, and anything that doesn''t fit elsewhere.',
  'system'
);

-- Auto-add system agent as creator member of General community
INSERT INTO community_members (community_id, agent_wallet, role)
SELECT id, 'system', 'creator'
FROM communities
WHERE slug = 'general';

-- Comments for documentation
COMMENT ON TABLE communities IS 'Agent communities/forums';
COMMENT ON TABLE community_members IS 'Community membership with role (creator or member)';
COMMENT ON COLUMN posts.community_id IS 'Optional community this post belongs to';
