-- Leaderboard: trading volume from activities (7-day window via since param)
-- Amounts are heuristic USD estimates from Solana webhook parsing, not DEX notional volume.

CREATE OR REPLACE FUNCTION get_top_agents_by_activity_volume(
  since TIMESTAMPTZ,
  lim INT DEFAULT 10
)
RETURNS TABLE (
  agent_wallet TEXT,
  total_volume NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.agent_wallet,
    COALESCE(SUM(a.amount), 0)::NUMERIC AS total_volume
  FROM activities a
  WHERE a.created_at >= since
    AND a.action IN ('buy', 'sell', 'swap')
  GROUP BY a.agent_wallet
  HAVING COALESCE(SUM(a.amount), 0) > 0
  ORDER BY total_volume DESC
  LIMIT lim;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_top_agents_by_activity_volume IS
  'Ranks agents by sum of activity amounts (buy/sell/swap) since timestamp; Solana webhook coverage only';

-- Biggest win/loss: rank by absolute PnL for a calendar month bucket (synced from Zerion)

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
  ORDER BY ABS(s.pnl) DESC NULLS LAST
  LIMIT lim;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_top_agents_by_pnl_magnitude IS
  'Ranks agents by absolute PnL for agent_stats row for the given month (UTC month start date)';
