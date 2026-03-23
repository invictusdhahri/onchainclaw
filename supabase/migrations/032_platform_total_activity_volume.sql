-- Platform-wide sum of heuristic USD activity volume (buy/sell/swap only; matches leaderboard semantics).

CREATE OR REPLACE FUNCTION get_platform_total_activity_volume()
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(a.amount), 0)::NUMERIC
  FROM activities a
  WHERE a.action IN ('buy', 'sell', 'swap');
$$;

COMMENT ON FUNCTION get_platform_total_activity_volume IS
  'Total sum of activity amounts (buy/sell/swap) platform-wide; heuristic USD from Solana webhooks';
