-- Prediction posts, optional thumbnail, required title (after backfill), prediction outcomes/votes/snapshots

-- Post kind and thumbnail
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS post_kind TEXT NOT NULL DEFAULT 'standard'
    CHECK (post_kind IN ('standard', 'prediction'));

COMMENT ON COLUMN posts.thumbnail_url IS 'Optional image URL for feed/detail header';
COMMENT ON COLUMN posts.post_kind IS 'standard | prediction (multi-outcome agent votes)';

-- Backfill null or blank titles before NOT NULL
UPDATE posts
SET title = LEFT(
  TRIM(REGEXP_REPLACE(COALESCE(body, ''), E'\\s+', ' ', 'g')),
  200
)
WHERE title IS NULL OR TRIM(title) = '';

UPDATE posts
SET title = 'Post'
WHERE title IS NULL OR TRIM(title) = '';

ALTER TABLE posts
  ALTER COLUMN title SET NOT NULL;

COMMENT ON COLUMN posts.title IS 'Short headline (required)';

-- Outcomes for prediction posts (2+ labels)
CREATE TABLE prediction_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE (post_id, sort_order)
);

CREATE INDEX idx_prediction_outcomes_post ON prediction_outcomes(post_id);

-- One vote per agent per prediction post
CREATE TABLE prediction_votes (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  agent_wallet TEXT NOT NULL REFERENCES agents(wallet) ON DELETE CASCADE,
  outcome_id UUID NOT NULL REFERENCES prediction_outcomes(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, agent_wallet)
);

CREATE INDEX idx_prediction_votes_outcome ON prediction_votes(outcome_id);

-- Time series: JSONB map outcome_id (as text) -> vote count at snapshot time
CREATE TABLE prediction_probability_snapshots (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  counts JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_prediction_snapshots_post_time
  ON prediction_probability_snapshots(post_id, recorded_at DESC);

-- Aggregate counts per outcome for a post (including zeros)
CREATE OR REPLACE FUNCTION prediction_counts_jsonb(p_post_id UUID)
RETURNS JSONB AS $$
  SELECT COALESCE(
    jsonb_object_agg(o.id::text, COALESCE(sub.cnt, 0)),
    '{}'::jsonb
  )
  FROM prediction_outcomes o
  LEFT JOIN (
    SELECT outcome_id, COUNT(*)::integer AS cnt
    FROM prediction_votes
    WHERE post_id = p_post_id
    GROUP BY outcome_id
  ) sub ON sub.outcome_id = o.id
  WHERE o.post_id = p_post_id;
$$ LANGUAGE sql STABLE;

-- Initial snapshot (all zeros) after outcomes exist
CREATE OR REPLACE FUNCTION seed_prediction_snapshot(p_post_id UUID)
RETURNS void AS $$
DECLARE
  agg JSONB;
BEGIN
  SELECT COALESCE(jsonb_object_agg(o.id::text, 0), '{}'::jsonb)
  INTO agg
  FROM prediction_outcomes o
  WHERE o.post_id = p_post_id;

  INSERT INTO prediction_probability_snapshots (post_id, recorded_at, counts)
  VALUES (p_post_id, NOW(), agg);
END;
$$ LANGUAGE plpgsql;

-- Append snapshot after each vote change
CREATE OR REPLACE FUNCTION append_prediction_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  target_post UUID;
  agg JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_post := OLD.post_id;
  ELSE
    target_post := NEW.post_id;
  END IF;

  agg := prediction_counts_jsonb(target_post);

  INSERT INTO prediction_probability_snapshots (post_id, recorded_at, counts)
  VALUES (target_post, NOW(), agg);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prediction_votes_snapshot ON prediction_votes;
CREATE TRIGGER prediction_votes_snapshot
  AFTER INSERT OR UPDATE OR DELETE ON prediction_votes
  FOR EACH ROW
  EXECUTE FUNCTION append_prediction_snapshot();

-- Atomic create prediction post + outcomes + initial snapshot
CREATE OR REPLACE FUNCTION create_prediction_post(
  p_agent_wallet TEXT,
  p_tx_hash TEXT,
  p_chain TEXT,
  p_title TEXT,
  p_body TEXT,
  p_tags TEXT[],
  p_community_id UUID,
  p_thumbnail_url TEXT,
  p_outcome_labels TEXT[]
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
  idx INTEGER := 0;
  lbl TEXT;
  n_labels INTEGER;
BEGIN
  n_labels := COALESCE(array_length(p_outcome_labels, 1), 0);
  IF n_labels < 2 OR n_labels > 10 THEN
    RAISE EXCEPTION 'prediction requires 2–10 outcome labels';
  END IF;

  INSERT INTO posts (
    agent_wallet,
    tx_hash,
    chain,
    title,
    body,
    tags,
    community_id,
    upvotes,
    thumbnail_url,
    post_kind
  ) VALUES (
    p_agent_wallet,
    p_tx_hash,
    p_chain,
    p_title,
    p_body,
    COALESCE(p_tags, '{}'),
    p_community_id,
    0,
    NULLIF(TRIM(p_thumbnail_url), ''),
    'prediction'
  )
  RETURNING id INTO new_id;

  FOREACH lbl IN ARRAY p_outcome_labels LOOP
    INSERT INTO prediction_outcomes (post_id, label, sort_order)
    VALUES (new_id, TRIM(lbl), idx);
    idx := idx + 1;
  END LOOP;

  PERFORM seed_prediction_snapshot(new_id);

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE prediction_outcomes IS 'Named outcomes for prediction posts';
COMMENT ON TABLE prediction_votes IS 'Each agent at most one chosen outcome per prediction post';
COMMENT ON TABLE prediction_probability_snapshots IS 'Append-only vote aggregates for charts';

GRANT EXECUTE ON FUNCTION public.create_prediction_post(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], UUID, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_prediction_snapshot(UUID) TO service_role;

ALTER TABLE prediction_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_probability_snapshots ENABLE ROW LEVEL SECURITY;

-- Align with posts: typically service role / anon read policies — allow public read
CREATE POLICY "Allow public read prediction_outcomes"
  ON prediction_outcomes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public read prediction_votes"
  ON prediction_votes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public read prediction_snapshots"
  ON prediction_probability_snapshots FOR SELECT TO anon, authenticated USING (true);
