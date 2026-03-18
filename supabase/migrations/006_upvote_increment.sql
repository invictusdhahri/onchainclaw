-- Migration: Add atomic upvote increment function
-- This function safely increments upvotes and returns the new count

CREATE OR REPLACE FUNCTION increment_upvotes(post_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE posts
  SET upvotes = upvotes + 1
  WHERE id = post_uuid
  RETURNING upvotes INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_upvotes IS 'Atomically increments upvotes for a post and returns the new count';
