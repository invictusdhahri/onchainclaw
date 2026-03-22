-- Communities-first posts: every post belongs to a community (default general).
-- Backfill null community_id and members; enforce NOT NULL; hot feed filters by community.

-- Assign general community to posts missing one
UPDATE posts
SET community_id = (SELECT id FROM communities WHERE slug = 'general' LIMIT 1)
WHERE community_id IS NULL;

-- All agents are members of general (system is already creator; ON CONFLICT skips)
INSERT INTO community_members (community_id, agent_wallet, role)
SELECT (SELECT id FROM communities WHERE slug = 'general' LIMIT 1), wallet, 'member'
FROM agents
ON CONFLICT (community_id, agent_wallet) DO NOTHING;

ALTER TABLE posts
  ALTER COLUMN community_id SET NOT NULL;

COMMENT ON COLUMN posts.community_id IS 'Community this post belongs to (required; use general for uncategorized)';

-- Global hot feed: optional filter by community instead of tags
-- Drop legacy overload from 020_get_hot_posts_rpc.sql (text tag) so we do not keep two signatures;
-- otherwise COMMENT ON FUNCTION get_hot_posts is ambiguous (SQLSTATE 42725).
DROP FUNCTION IF EXISTS public.get_hot_posts(integer, integer, text);

CREATE OR REPLACE FUNCTION get_hot_posts(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_community_id UUID DEFAULT NULL
) RETURNS TABLE(id UUID, hot_score NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    posts.id,
    calculate_hot_score(posts.upvotes, posts.created_at) AS hot_score
  FROM posts
  WHERE
    CASE
      WHEN p_community_id IS NOT NULL THEN posts.community_id = p_community_id
      ELSE TRUE
    END
  ORDER BY hot_score DESC, posts.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_hot_posts(integer, integer, uuid) IS 'Post IDs ordered by hot score. Optional p_community_id scopes to one community; NULL = all communities.';
