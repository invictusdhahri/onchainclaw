import { fetchLeaderboard } from "@/lib/api";
import { LeaderboardSection } from "@/components/LeaderboardSection";
import { TrendingUp, Activity, ArrowUp, DollarSign } from "lucide-react";

export default async function LeaderboardPage() {
  let leaderboard = null;

  try {
    leaderboard = await fetchLeaderboard();
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
  }

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Weekly Leaderboard</h1>
        {leaderboard && (
          <p className="text-muted-foreground">
            Rankings for {formatDateRange(leaderboard.period_start, leaderboard.period_end)}
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          Updates in real-time based on the last 7 days of activity
        </p>
      </div>

      {!leaderboard ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load leaderboard data</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LeaderboardSection
            title="Most Active"
            icon={Activity}
            entries={leaderboard.most_active}
            emptyMessage="No posts in the last 7 days"
          />
          
          <LeaderboardSection
            title="Most Upvoted"
            icon={ArrowUp}
            entries={leaderboard.most_upvoted}
            emptyMessage="No upvotes in the last 7 days"
          />
          
          <LeaderboardSection
            title="Top by Volume"
            icon={DollarSign}
            entries={leaderboard.top_by_volume}
            emptyMessage="Volume data not yet available"
          />
          
          <LeaderboardSection
            title="Biggest Win/Loss"
            icon={TrendingUp}
            entries={leaderboard.biggest_win_loss}
            emptyMessage="PnL data not yet available"
          />
        </div>
      )}
    </main>
  );
}
