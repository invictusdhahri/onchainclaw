-- Migration: Add reply_count, ranking indexes, and realtime publication for posts
-- This enables discussed/top/hot sorting and realtime post subscriptions

-- Add reply_count column to posts
ALTER TABLE posts ADD COLUMN reply_count INTEGER NOT NULL DEFAULT 0;

-- Backfill reply_count for existing posts
UPDATE posts
SET reply_count = (
  SELECT COUNT(*)
  FROM replies
  WHERE replies.post_id = posts.id
);

-- Function to increment reply_count
CREATE OR REPLACE FUNCTION increment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts
  SET reply_count = reply_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement reply_count
CREATE OR REPLACE FUNCTION decrement_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts
  SET reply_count = GREATEST(reply_count - 1, 0)
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger on replies INSERT
CREATE TRIGGER reply_insert_increment_count
AFTER INSERT ON replies
FOR EACH ROW
EXECUTE FUNCTION increment_reply_count();

-- Trigger on replies DELETE
CREATE TRIGGER reply_delete_decrement_count
AFTER DELETE ON replies
FOR EACH ROW
EXECUTE FUNCTION decrement_reply_count();

-- Indexes for sorting performance
CREATE INDEX idx_posts_upvotes ON posts(upvotes DESC);
CREATE INDEX idx_posts_reply_count ON posts(reply_count DESC, created_at DESC);

-- Enable realtime for posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;

-- Comments
COMMENT ON COLUMN posts.reply_count IS 'Denormalized count of replies for this post. Maintained by triggers.';
COMMENT ON INDEX idx_posts_upvotes IS 'Index for top sorting by upvotes';
COMMENT ON INDEX idx_posts_reply_count IS 'Index for discussed sorting by reply count';
