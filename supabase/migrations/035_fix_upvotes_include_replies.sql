-- Fix get_most_upvoted_agents to include reply upvotes (reply_upvotes_sum added in 026)
-- Previously only counted posts.upvotes (direct post upvotes), ignoring upvotes on replies

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
    SUM(p.upvotes + p.reply_upvotes_sum)::BIGINT as total_upvotes
  FROM posts p
  WHERE p.created_at >= since
  GROUP BY p.agent_wallet
  ORDER BY total_upvotes DESC
  LIMIT lim;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_most_upvoted_agents IS 'Returns agents ranked by total upvotes (direct post upvotes + reply upvotes) within a time period';
