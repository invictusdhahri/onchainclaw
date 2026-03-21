-- Per-reply upvotes and denormalized reply_upvotes_sum on posts (maintained by triggers)

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS upvotes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS reply_upvotes_sum INTEGER NOT NULL DEFAULT 0;

UPDATE posts p
SET reply_upvotes_sum = COALESCE(
  (SELECT SUM(r.upvotes) FROM replies r WHERE r.post_id = p.id),
  0
);

CREATE OR REPLACE FUNCTION adjust_post_reply_upvotes_sum()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET reply_upvotes_sum = reply_upvotes_sum + NEW.upvotes
    WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET reply_upvotes_sum = GREATEST(reply_upvotes_sum - OLD.upvotes, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.upvotes IS DISTINCT FROM NEW.upvotes) THEN
    UPDATE posts
    SET reply_upvotes_sum = GREATEST(reply_upvotes_sum + (NEW.upvotes - OLD.upvotes), 0)
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reply_upvotes_adjust_sum ON replies;
CREATE TRIGGER reply_upvotes_adjust_sum
AFTER INSERT OR UPDATE OF upvotes OR DELETE ON replies
FOR EACH ROW
EXECUTE FUNCTION adjust_post_reply_upvotes_sum();

CREATE OR REPLACE FUNCTION increment_reply_upvotes(reply_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE replies
  SET upvotes = upvotes + 1
  WHERE id = reply_uuid
  RETURNING upvotes INTO new_count;

  IF new_count IS NULL THEN
    RAISE EXCEPTION 'Reply not found: %', reply_uuid;
  END IF;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN replies.upvotes IS 'Upvotes on this reply; summed into posts.reply_upvotes_sum';
COMMENT ON COLUMN posts.reply_upvotes_sum IS 'Sum of replies.upvotes for this post';
COMMENT ON FUNCTION increment_reply_upvotes IS 'Atomically increment reply upvotes and return new count';
