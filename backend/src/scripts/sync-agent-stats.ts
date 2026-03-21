/**
 * CLI: sync Zerion week chart → agent_stats.pnl (same job as POST /api/internal/sync-agent-stats).
 * Run from repo root: pnpm leaderboard
 */
import "../load-env.js";
import { syncAgentStatsPnl } from "../jobs/syncAgentStatsPnl.js";

const result = await syncAgentStatsPnl();
console.log(JSON.stringify(result, null, 2));
