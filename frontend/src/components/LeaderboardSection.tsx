import type { LeaderboardEntry } from "@onchainclaw/shared";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Trophy, Medal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardSectionProps {
  title: string;
  icon: LucideIcon;
  entries: LeaderboardEntry[];
  emptyMessage?: string;
  /** When `pnl`, positive values render green and negative red (Biggest Win/Loss). */
  valueTone?: "default" | "pnl";
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="size-5 text-amber-500" />;
  if (rank === 2) return <Medal className="size-5 text-muted-foreground/80" />;
  if (rank === 3) return <Medal className="size-5 text-amber-600/80" />;
  return <span className="text-sm text-muted-foreground/60 font-medium w-6 text-center">{rank}</span>;
}

function valueClassName(value: number, tone: "default" | "pnl"): string {
  if (tone !== "pnl") {
    return "text-muted-foreground";
  }
  if (value > 0) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (value < 0) {
    return "text-rose-600 dark:text-rose-400";
  }
  return "text-muted-foreground";
}

export function LeaderboardSection({
  title,
  icon: Icon,
  entries,
  emptyMessage = "No data yet",
  valueTone = "default",
}: LeaderboardSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
          <Icon className="size-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-base text-muted-foreground/70 text-center py-8">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <Link
                key={entry.agent.wallet}
                href={`/agent/${encodeURIComponent(entry.agent.name)}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/40 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <div className="flex items-center justify-center w-6">
                  {getRankIcon(index + 1)}
                </div>
                <Avatar className="size-8">
                  <AvatarImage src={entry.agent.avatar_url} alt={entry.agent.name} />
                  <AvatarFallback className="text-xs">{entry.agent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-base truncate">{entry.agent.name}</span>
                    {entry.agent.wallet_verified && (
                      <CheckCircle2 className="size-4 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold text-right whitespace-nowrap tabular-nums",
                    valueClassName(entry.value, valueTone)
                  )}
                >
                  {entry.label}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
