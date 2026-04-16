import type { PostActivitySummary } from "@onchainclaw/shared";
import {
  TrendingUp,
  TrendingDown,
  Send,
  Download,
  ArrowLeftRight,
  Sparkles,
  FileText,
  Activity,
} from "lucide-react";

interface PostTransactionActivityProps {
  activity: PostActivitySummary;
}

function getActionIcon(action: string) {
  switch (action) {
    case "buy":
      return <TrendingUp className="size-3 shrink-0" />;
    case "sell":
      return <TrendingDown className="size-3 shrink-0" />;
    case "send":
      return <Send className="size-3 shrink-0" />;
    case "receive":
      return <Download className="size-3 shrink-0" />;
    case "swap":
      return <ArrowLeftRight className="size-3 shrink-0" />;
    case "create":
      return <Sparkles className="size-3 shrink-0" />;
    case "memo":
      return <FileText className="size-3 shrink-0" />;
    default:
      return <Activity className="size-3 shrink-0" />;
  }
}

function getActionClasses(action: string): { wrapper: string; label: string } {
  switch (action) {
    case "buy":
      return {
        wrapper:
          "bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
        label: "bought",
      };
    case "sell":
      return {
        wrapper:
          "bg-rose-500/[0.08] border border-rose-500/20 text-rose-600 dark:text-rose-400",
        label: "sold",
      };
    case "send":
      return {
        wrapper:
          "bg-sky-500/[0.08] border border-sky-500/20 text-sky-600 dark:text-sky-400",
        label: "sent",
      };
    case "receive":
      return {
        wrapper:
          "bg-teal-500/[0.08] border border-teal-500/20 text-teal-600 dark:text-teal-400",
        label: "received",
      };
    case "swap":
      return {
        wrapper:
          "bg-violet-500/[0.08] border border-violet-500/20 text-violet-600 dark:text-violet-400",
        label: "swapped",
      };
    case "create":
      return {
        wrapper:
          "bg-amber-500/[0.08] border border-amber-500/20 text-amber-600 dark:text-amber-400",
        label: "launched",
      };
    case "memo":
      return {
        wrapper:
          "bg-indigo-500/[0.08] border border-indigo-500/20 text-indigo-600 dark:text-indigo-400",
        label: "memo",
      };
    default:
      return {
        wrapper:
          "bg-muted/40 border border-border text-muted-foreground",
        label: action,
      };
  }
}

function formatAmount(amount: number): string {
  if (amount <= 0) return "";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

function formatToken(activity: PostActivitySummary): string {
  if (activity.token_symbol) return `$${activity.token_symbol}`;
  if (activity.token) return `${activity.token.slice(0, 4)}…${activity.token.slice(-4)}`;
  return "";
}

const MAX_MEMO_DISPLAY = 42;

export function PostTransactionActivity({ activity }: PostTransactionActivityProps) {
  // Never show a badge for unclassified transactions
  if (activity.action === "unknown") return null;

  const { wrapper, label } = getActionClasses(activity.action);
  const amountStr = formatAmount(activity.amount);
  const tokenStr = formatToken(activity);

  // Memo: show decoded text instead of amount/token
  if (activity.action === "memo") {
    const text = activity.memo_text ?? "";
    const displayText = text.length > MAX_MEMO_DISPLAY
      ? `${text.slice(0, MAX_MEMO_DISPLAY)}…`
      : text;

    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${wrapper}`}
      >
        {getActionIcon("memo")}
        <span>{label}</span>
        {displayText && (
          <span className="opacity-75 font-normal" title={text}>
            {displayText}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${wrapper}`}
    >
      {getActionIcon(activity.action)}
      <span>{label}</span>
      {(amountStr || tokenStr) && (
        <span className="opacity-80">
          {[tokenStr, amountStr].filter(Boolean).join(" · ")}
        </span>
      )}
    </div>
  );
}
