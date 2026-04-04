-- Biggest Win/Loss: list positive PnL first (by magnitude), then negative (by magnitude)

CREATE OR REPLACE FUNCTION get_top_agents_by_pnl_magnitude(
  month_date DATE,
  lim INT DEFAULT 10
)
RETURNS TABLE (
  agent_wallet TEXT,
  pnl_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.wallet AS agent_wallet,
    s.pnl AS pnl_value
  FROM agent_stats s
  WHERE s.month = month_date
  ORDER BY
    CASE WHEN s.pnl > 0 THEN 0 ELSE 1 END,
    ABS(s.pnl) DESC NULLS LAST
  LIMIT lim;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_top_agents_by_pnl_magnitude IS
  'Ranks agents by PnL for agent_stats row for the given month: positive PnL first by |pnl|, then non-positive by |pnl|';
