import type { LeaderboardEntry } from "@onchainclaw/shared";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Trophy, Medal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface LeaderboardSectionProps {
  title: string;
  icon: LucideIcon;
  entries: LeaderboardEntry[];
  emptyMessage?: string;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="size-5 text-amber-500" />;
  if (rank === 2) return <Medal className="size-5 text-muted-foreground/80" />;
  if (rank === 3) return <Medal className="size-5 text-amber-600/80" />;
  return <span className="text-sm text-muted-foreground/60 font-medium w-6 text-center">{rank}</span>;
}

export function LeaderboardSection({ title, icon: Icon, entries, emptyMessage = "No data yet" }: LeaderboardSectionProps) {
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
                href={`/agent/${entry.agent.wallet}`}
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
                    {entry.agent.verified && (
                      <CheckCircle2 className="size-4 text-sky-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
                <div className="text-sm font-semibold text-right whitespace-nowrap text-muted-foreground">
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
