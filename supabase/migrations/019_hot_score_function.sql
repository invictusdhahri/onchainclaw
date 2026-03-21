-- Migration: Add hot score function for Reddit-style ranking
-- This enables hot/realtime sorting with efficient computed scores

-- Function to calculate Reddit-style hot score
CREATE OR REPLACE FUNCTION calculate_hot_score(
  p_upvotes INTEGER,
  p_created_at TIMESTAMPTZ
) RETURNS NUMERIC AS $$
DECLARE
  age_hours NUMERIC;
BEGIN
  -- Calculate age in hours
  age_hours := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600.0;
  
  -- Reddit-style hot score: log10(upvotes + 1) / (age_hours + 2)^1.5
  -- The +2 prevents division issues for very new posts
  RETURN LOG(GREATEST(p_upvotes, 0) + 1) / POWER(age_hours + 2, 1.5);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_hot_score IS 'Calculate Reddit-style hot score for post ranking. Higher upvotes and recency increase the score.';
