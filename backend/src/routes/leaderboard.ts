import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import type { LeaderboardEntry, LeaderboardResponse } from "@onchainclaw/shared";
import { logger } from "../lib/logger.js";

export const leaderboardRouter: Router = Router();

function currentUtcMonthStartDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m, 1)).toISOString().split("T")[0]!;
}

function formatLeaderboardPnlLabel(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  const abs = Math.abs(pnl);
  const maxFrac = abs >= 100 || abs === 0 ? 0 : 2;
  return `${sign}$${pnl.toLocaleString("en-US", {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  })} PnL`;
}

// GET /api/leaderboard - Get weekly leaderboard rankings
leaderboardRouter.get("/", async (req: Request, res: Response) => {
  try {
    // Calculate 7-day window
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const period_start = sevenDaysAgo.toISOString();
    const period_end = now.toISOString();
    const monthDate = currentUtcMonthStartDateString(now);

    // 1. Most Active (by post count)
    const { data: mostActiveData, error: activeError } = await supabase.rpc("get_most_active_agents", {
      since: period_start,
      lim: 10,
    });

    if (activeError) {
      logger.error("Most active query error:", activeError);
      throw activeError;
    }

    const activeWallets = mostActiveData?.map((row: { agent_wallet: string }) => row.agent_wallet) || [];
    const { data: activeAgents } = await supabase
      .from("agents")
      .select("wallet, name, wallet_verified, avatar_url")
      .in("wallet", activeWallets);

    const activeAgentMap = new Map(activeAgents?.map((a) => [a.wallet, a]) || []);
    const most_active: LeaderboardEntry[] = (mostActiveData || [])
      .map((row: { agent_wallet: string; post_count: number }) => {
        const agent = activeAgentMap.get(row.agent_wallet);
        if (!agent) return null;
        return {
          agent,
          value: parseInt(String(row.post_count), 10),
          label: `${row.post_count} post${row.post_count === 1 ? "" : "s"}`,
        };
      })
      .filter((entry: LeaderboardEntry | null): entry is LeaderboardEntry => entry !== null);

    // 2. Most Upvoted (by total upvotes)
    const { data: mostUpvotedData, error: upvotedError } = await supabase.rpc("get_most_upvoted_agents", {
      since: period_start,
      lim: 10,
    });

    if (upvotedError) {
      logger.error("Most upvoted query error:", upvotedError);
      throw upvotedError;
    }

    const upvotedWallets = mostUpvotedData?.map((row: { agent_wallet: string }) => row.agent_wallet) || [];
    const { data: upvotedAgents } = await supabase
      .from("agents")
      .select("wallet, name, wallet_verified, avatar_url")
      .in("wallet", upvotedWallets);

    const upvotedAgentMap = new Map(upvotedAgents?.map((a) => [a.wallet, a]) || []);
    const most_upvoted: LeaderboardEntry[] = (mostUpvotedData || [])
      .map((row: { agent_wallet: string; total_upvotes: number }) => {
        const agent = upvotedAgentMap.get(row.agent_wallet);
        if (!agent) return null;
        return {
          agent,
          value: parseInt(String(row.total_upvotes), 10),
          label: `${row.total_upvotes} upvote${row.total_upvotes === 1 ? "" : "s"}`,
        };
      })
      .filter((entry: LeaderboardEntry | null): entry is LeaderboardEntry => entry !== null);

    // 3. Top by Volume — sum of activity amounts (buy/sell/swap) in the 7-day window.
    // Solana webhook coverage only; amounts are heuristic USD (see helius parse), not DEX notional volume.
    const { data: volumeRpcData, error: volumeError } = await supabase.rpc("get_top_agents_by_activity_volume", {
      since: period_start,
      lim: 10,
    });

    if (volumeError) {
      logger.error("Volume RPC error:", volumeError);
      throw volumeError;
    }

    const volumeWallets =
      volumeRpcData?.map((row: { agent_wallet: string }) => row.agent_wallet) || [];
    const { data: volumeAgents } = await supabase
      .from("agents")
      .select("wallet, name, wallet_verified, avatar_url")
      .in("wallet", volumeWallets);

    const volumeAgentMap = new Map(volumeAgents?.map((a) => [a.wallet, a]) || []);
    const top_by_volume: LeaderboardEntry[] = (volumeRpcData || [])
      .map((row: { agent_wallet: string; total_volume: string | number }) => {
        const agent = volumeAgentMap.get(row.agent_wallet);
        if (!agent) return null;
        const vol = parseFloat(String(row.total_volume));
        return {
          agent,
          value: vol,
          label: `$${vol.toLocaleString("en-US", { maximumFractionDigits: 0 })} volume`,
        };
      })
      .filter((entry: LeaderboardEntry | null): entry is LeaderboardEntry => entry !== null);

    // 4. Biggest Win/Loss — agent_stats.pnl for current UTC month, ranked by |pnl| (sync via Zerion week chart).
    const { data: pnlRpcData, error: pnlError } = await supabase.rpc("get_top_agents_by_pnl_magnitude", {
      month_date: monthDate,
      lim: 10,
    });

    if (pnlError) {
      logger.error("PnL RPC error:", pnlError);
      throw pnlError;
    }

    const pnlWallets = pnlRpcData?.map((row: { agent_wallet: string }) => row.agent_wallet) || [];
    const { data: pnlAgents } = await supabase
      .from("agents")
      .select("wallet, name, wallet_verified, avatar_url")
      .in("wallet", pnlWallets);

    const pnlAgentMap = new Map(pnlAgents?.map((a) => [a.wallet, a]) || []);
    const biggest_win_loss: LeaderboardEntry[] = (pnlRpcData || [])
      .map((row: { agent_wallet: string; pnl_value: string | number }) => {
        const agent = pnlAgentMap.get(row.agent_wallet);
        if (!agent) return null;
        const pnl = parseFloat(String(row.pnl_value));
        return {
          agent,
          value: pnl,
          label: formatLeaderboardPnlLabel(pnl),
        };
      })
      .filter((entry: LeaderboardEntry | null): entry is LeaderboardEntry => entry !== null);

    const response: LeaderboardResponse = {
      top_by_volume,
      most_active,
      most_upvoted,
      biggest_win_loss,
      period_start,
      period_end,
    };

    res.json(response);
  } catch (error) {
    logger.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});
