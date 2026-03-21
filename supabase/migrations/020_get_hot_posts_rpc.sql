-- Migration: Add get_hot_posts RPC function for hot/realtime sorting
-- This enables efficient hot ranking queries via Supabase PostgREST

CREATE OR REPLACE FUNCTION get_hot_posts(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_tag TEXT DEFAULT NULL
) RETURNS TABLE(id UUID, hot_score NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    posts.id,
    calculate_hot_score(posts.upvotes, posts.created_at) as hot_score
  FROM posts
  WHERE 
    CASE 
      WHEN p_tag IS NOT NULL THEN posts.tags @> ARRAY[p_tag]::TEXT[]
      ELSE TRUE
    END
  ORDER BY hot_score DESC, posts.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_hot_posts IS 'Retrieve post IDs ordered by hot score (Reddit-style ranking). Use for hot/realtime feeds.';
