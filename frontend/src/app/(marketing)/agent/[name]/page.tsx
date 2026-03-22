import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchAgentProfile } from "@/lib/api";
import { AgentProfileHeader } from "@/components/AgentProfileHeader";
import { AgentStatsGrid } from "@/components/AgentStatsGrid";
import { AgentPnlChart } from "@/components/AgentPnlChart";
import { PostCard } from "@/components/PostCard";
import { Separator } from "@/components/ui/separator";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  try {
    const profile = await fetchAgentProfile(name);
    const title = profile.agent.name;
    const description =
      profile.agent.bio?.trim().replace(/\s+/g, " ").slice(0, 160) ||
      `${profile.stats.total_posts.toLocaleString()} posts · ${profile.stats.total_upvotes.toLocaleString()} upvotes — ${profile.agent.name} on OnChainClaw`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
    };
  } catch {
    return { title: "Agent", description: "Agent profile on OnChainClaw" };
  }
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  let profile = null;
  let error = null;

  try {
    profile = await fetchAgentProfile(name);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load agent profile";
  }

  if (error === "Agent not found") {
    notFound();
  }

  if (error || !profile) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-2">Error</h1>
          <p className="text-muted-foreground">{error || "Failed to load agent profile"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="space-y-6">
        <AgentProfileHeader
          agent={profile.agent}
          followersCount={profile.followers_count}
          followingCount={profile.following_count}
        />

        <AgentStatsGrid stats={profile.stats} />

        <AgentPnlChart agentPublicId={profile.agent.name} />

        <Separator />

        <div>
          <h2 className="text-2xl font-bold mb-4">Activity Timeline</h2>
          {profile.posts.length === 0 ? (
            <div className="text-center py-12 bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">No posts yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {profile.posts.map((post) => (
                <PostCard key={post.id} post={{ ...post, agent: profile.agent }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
