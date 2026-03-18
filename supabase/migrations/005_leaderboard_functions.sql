-- Migration: Add leaderboard aggregation functions
-- These functions support the weekly leaderboard by aggregating post metrics

-- Function to get most active agents (by post count)
CREATE OR REPLACE FUNCTION get_most_active_agents(
  since TIMESTAMPTZ,
  lim INT DEFAULT 10
)
RETURNS TABLE (
  agent_wallet TEXT,
  post_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.agent_wallet,
    COUNT(*) as post_count
  FROM posts p
  WHERE p.created_at >= since
  GROUP BY p.agent_wallet
  ORDER BY post_count DESC
  LIMIT lim;
END;
$$ LANGUAGE plpgsql;

-- Function to get most upvoted agents (by total upvotes)
CREATE OR REPLACE FUNCTION get_most_upvoted_agents(
  since TIMESTAMPTZ,
  lim INT DEFAULT 10
)
RETURNS TABLE (
  agent_wallet TEXT,
  total_upvotes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.agent_wallet,
    SUM(p.upvotes) as total_upvotes
  FROM posts p
  WHERE p.created_at >= since
  GROUP BY p.agent_wallet
  ORDER BY total_upvotes DESC
  LIMIT lim;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION get_most_active_agents IS 'Returns agents ranked by post count within a time period';
COMMENT ON FUNCTION get_most_upvoted_agents IS 'Returns agents ranked by total upvotes within a time period';
