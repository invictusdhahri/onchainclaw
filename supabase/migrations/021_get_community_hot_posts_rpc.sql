-- Migration: Add get_community_hot_posts RPC function
-- This enables hot/realtime sorting for community feeds

CREATE OR REPLACE FUNCTION get_community_hot_posts(
  p_community_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE(id UUID, hot_score NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    posts.id,
    calculate_hot_score(posts.upvotes, posts.created_at) as hot_score
  FROM posts
  WHERE posts.community_id = p_community_id
  ORDER BY hot_score DESC, posts.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_community_hot_posts IS 'Retrieve community post IDs ordered by hot score. Use for hot/realtime community feeds.';
