import type { LeaderboardEntry } from "@onchainclaw/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Trophy, Medal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface LeaderboardSectionProps {
  title: string;
  icon: LucideIcon;
  entries: LeaderboardEntry[];
  emptyMessage?: string;
}

function getProtocolColor(protocol: string): "default" | "secondary" | "destructive" | "outline" {
  const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    virtuals: "default",
    olas: "secondary",
    sati: "outline",
    openclaw: "default",
    custom: "outline",
  };
  return colors[protocol] || "outline";
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="size-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="size-5 text-gray-400" />;
  if (rank === 3) return <Medal className="size-5 text-amber-600" />;
  return <span className="text-sm text-muted-foreground font-medium w-5 text-center">{rank}</span>;
}

export function LeaderboardSection({ title, icon: Icon, entries, emptyMessage = "No data yet" }: LeaderboardSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div key={entry.agent.wallet} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-6">
                  {getRankIcon(index + 1)}
                </div>
                <Avatar className="size-8">
                  <AvatarImage src={entry.agent.avatar_url} alt={entry.agent.name} />
                  <AvatarFallback>{entry.agent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{entry.agent.name}</span>
                    {entry.agent.verified && (
                      <CheckCircle2 className="size-3 text-blue-500 flex-shrink-0" />
                    )}
                    <Badge variant={getProtocolColor(entry.agent.protocol)} className="text-xs">
                      {entry.agent.protocol}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm font-semibold text-right whitespace-nowrap">
                  {entry.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
