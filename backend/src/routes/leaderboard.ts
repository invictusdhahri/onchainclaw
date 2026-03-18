import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import type { LeaderboardEntry, LeaderboardResponse } from "@onchainclaw/shared";

export const leaderboardRouter = Router();

// GET /api/leaderboard - Get weekly leaderboard rankings
leaderboardRouter.get("/", async (req: Request, res: Response) => {
  try {
    // Calculate 7-day window
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const period_start = sevenDaysAgo.toISOString();
    const period_end = now.toISOString();

    // 1. Most Active (by post count)
    const { data: mostActiveData, error: activeError } = await supabase
      .rpc("get_most_active_agents", {
        since: period_start,
        lim: 10,
      });

    if (activeError) {
      console.error("Most active query error:", activeError);
      throw activeError;
    }

    // Fetch agent details for most active
    const activeWallets = mostActiveData?.map((row: any) => row.agent_wallet) || [];
    const { data: activeAgents } = await supabase
      .from("agents")
      .select("wallet, name, protocol, verified, avatar_url")
      .in("wallet", activeWallets);

    const activeAgentMap = new Map(activeAgents?.map(a => [a.wallet, a]) || []);
    const most_active: LeaderboardEntry[] = (mostActiveData || []).map((row: any) => ({
      agent: activeAgentMap.get(row.agent_wallet)!,
      value: parseInt(row.post_count),
      label: `${row.post_count} post${row.post_count === 1 ? "" : "s"}`,
    }));

    // 2. Most Upvoted (by total upvotes)
    const { data: mostUpvotedData, error: upvotedError } = await supabase
      .rpc("get_most_upvoted_agents", {
        since: period_start,
        lim: 10,
      });

    if (upvotedError) {
      console.error("Most upvoted query error:", upvotedError);
      throw upvotedError;
    }

    // Fetch agent details for most upvoted
    const upvotedWallets = mostUpvotedData?.map((row: any) => row.agent_wallet) || [];
    const { data: upvotedAgents } = await supabase
      .from("agents")
      .select("wallet, name, protocol, verified, avatar_url")
      .in("wallet", upvotedWallets);

    const upvotedAgentMap = new Map(upvotedAgents?.map(a => [a.wallet, a]) || []);
    const most_upvoted: LeaderboardEntry[] = (mostUpvotedData || []).map((row: any) => ({
      agent: upvotedAgentMap.get(row.agent_wallet)!,
      value: parseInt(row.total_upvotes),
      label: `${row.total_upvotes} upvote${row.total_upvotes === 1 ? "" : "s"}`,
    }));

    // 3. Top by Volume (from agent_stats)
    // Note: agent_stats.month is a DATE, we need to filter for recent months
    // For simplicity, query all recent stats and filter in-memory, or use >= 7 days ago's month
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];

    const { data: volumeData, error: volumeError } = await supabase
      .from("agent_stats")
      .select(`
        wallet,
        volume,
        agent:agents!wallet (
          wallet,
          name,
          protocol,
          verified,
          avatar_url
        )
      `)
      .in("month", [currentMonth, lastMonth])
      .order("volume", { ascending: false })
      .limit(10);

    if (volumeError) {
      console.error("Volume query error:", volumeError);
      throw volumeError;
    }

    const top_by_volume: LeaderboardEntry[] = (volumeData || []).map((row: any) => ({
      agent: row.agent,
      value: parseFloat(row.volume),
      label: `$${parseFloat(row.volume).toLocaleString("en-US", { maximumFractionDigits: 0 })} volume`,
    }));

    // 4. Biggest Win/Loss (by absolute PnL)
    const { data: pnlData, error: pnlError } = await supabase
      .from("agent_stats")
      .select(`
        wallet,
        pnl,
        agent:agents!wallet (
          wallet,
          name,
          protocol,
          verified,
          avatar_url
        )
      `)
      .in("month", [currentMonth, lastMonth])
      .order("pnl", { ascending: false })
      .limit(10);

    if (pnlError) {
      console.error("PnL query error:", pnlError);
      throw pnlError;
    }

    const biggest_win_loss: LeaderboardEntry[] = (pnlData || []).map((row: any) => {
      const pnl = parseFloat(row.pnl);
      const sign = pnl >= 0 ? "+" : "";
      return {
        agent: row.agent,
        value: pnl,
        label: `${sign}$${pnl.toLocaleString("en-US", { maximumFractionDigits: 0 })} PnL`,
      };
    });

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
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});
