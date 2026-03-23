import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import {
  buildZerionChartUrl,
  fetchZerionWith429Retry,
  getZerionApiKey,
  isZerionQueryableWallet,
  mapZerionChartResponse,
  weekPortfolioDeltaFromChart,
} from "../lib/zerion.js";

const PAGE_SIZE = 500;
/** Space Zerion chart calls — parallel sync trips free-tier rate limits quickly. */
const ZERION_SYNC_GAP_MS = 450;

function currentUtcMonthStartDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return new Date(Date.UTC(y, m, 1)).toISOString().split("T")[0]!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type SyncAgentStatsPnlResult = {
  month: string;
  agentsTotal: number;
  skippedInvalidWallet: number;
  updated: number;
  skippedNoKey: number;
  failed: number;
};

/**
 * For each registered agent, fetch Zerion week chart and upsert agent_stats.pnl
 * with portfolio change (last − first). Not full realized PnL.
 */
export async function syncAgentStatsPnl(): Promise<SyncAgentStatsPnlResult> {
  const month = currentUtcMonthStartDateString();
  const wallets: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("agents")
      .select("wallet")
      .order("wallet")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`syncAgentStatsPnl: failed to list agents: ${error.message}`);
    }
    if (!data?.length) break;
    for (const row of data) {
      wallets.push(row.wallet);
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const apiKey = getZerionApiKey();
  if (!apiKey) {
    logger.warn("[syncAgentStatsPnl] ZERION_API_KEY missing — skipping");
    return {
      month,
      agentsTotal: wallets.length,
      skippedInvalidWallet: 0,
      updated: 0,
      skippedNoKey: wallets.length,
      failed: 0,
    };
  }

  const queryable = wallets.filter(isZerionQueryableWallet);
  const skippedInvalidWallet = wallets.length - queryable.length;
  if (skippedInvalidWallet > 0) {
    logger.warn(
      `[syncAgentStatsPnl] skipping ${skippedInvalidWallet} agent(s) with non-chain wallet ids (Zerion requires Solana or EVM addresses)`
    );
  }

  type Outcome = "updated" | "failed";
  const outcomes: Outcome[] = [];

  for (let i = 0; i < queryable.length; i++) {
    const wallet = queryable[i]!;
    if (i > 0) {
      await sleep(ZERION_SYNC_GAP_MS);
    }

    const url = buildZerionChartUrl(wallet, "week");
    try {
      const res = await fetchZerionWith429Retry(url, apiKey);
      if (!res.ok) {
        logger.warn(
          `[syncAgentStatsPnl] Zerion ${res.status} for ${wallet.slice(0, 8)}… — ${(await res.text()).slice(0, 120)}`
        );
        outcomes.push("failed");
        continue;
      }
      const raw: unknown = await res.json();
      const chart = mapZerionChartResponse(raw, "week");
      const pnl = weekPortfolioDeltaFromChart(chart);

      const { error: upsertError } = await supabase.from("agent_stats").upsert(
        {
          wallet,
          month,
          pnl,
        },
        { onConflict: "wallet,month" }
      );

      if (upsertError) {
        logger.error(`[syncAgentStatsPnl] upsert failed ${wallet.slice(0, 8)}…:`, upsertError.message);
        outcomes.push("failed");
        continue;
      }
      outcomes.push("updated");
    } catch (e) {
      logger.error(`[syncAgentStatsPnl] ${wallet.slice(0, 8)}…:`, e);
      outcomes.push("failed");
    }
  }

  const updated = outcomes.filter((o) => o === "updated").length;
  const failed = outcomes.filter((o) => o === "failed").length;

  return {
    month,
    agentsTotal: wallets.length,
    skippedInvalidWallet,
    updated,
    skippedNoKey: 0,
    failed,
  };
}
