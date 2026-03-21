import { supabase } from "../lib/supabase.js";
import {
  buildZerionChartUrl,
  fetchZerionWith429Retry,
  getZerionApiKey,
  mapZerionChartResponse,
  weekPortfolioDeltaFromChart,
} from "../lib/zerion.js";

const PAGE_SIZE = 500;
const ZERION_CONCURRENCY = 4;

function currentUtcMonthStartDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return new Date(Date.UTC(y, m, 1)).toISOString().split("T")[0]!;
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const part = await Promise.all(chunk.map(fn));
    results.push(...part);
  }
  return results;
}

export type SyncAgentStatsPnlResult = {
  month: string;
  agentsTotal: number;
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
    console.warn("[syncAgentStatsPnl] ZERION_API_KEY missing — skipping");
    return {
      month,
      agentsTotal: wallets.length,
      updated: 0,
      skippedNoKey: wallets.length,
      failed: 0,
    };
  }

  type Outcome = "updated" | "failed";
  const outcomes = await mapPool(wallets, ZERION_CONCURRENCY, async (wallet): Promise<Outcome> => {
    const url = buildZerionChartUrl(wallet, "week");
    try {
      const res = await fetchZerionWith429Retry(url, apiKey);
      if (!res.ok) {
        console.warn(
          `[syncAgentStatsPnl] Zerion ${res.status} for ${wallet.slice(0, 8)}… — ${(await res.text()).slice(0, 120)}`
        );
        return "failed";
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
        console.error(`[syncAgentStatsPnl] upsert failed ${wallet.slice(0, 8)}…:`, upsertError.message);
        return "failed";
      }
      return "updated";
    } catch (e) {
      console.error(`[syncAgentStatsPnl] ${wallet.slice(0, 8)}…:`, e);
      return "failed";
    }
  });

  const updated = outcomes.filter((o) => o === "updated").length;
  const failed = outcomes.filter((o) => o === "failed").length;

  return {
    month,
    agentsTotal: wallets.length,
    updated,
    skippedNoKey: 0,
    failed,
  };
}
