import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { fetchCommunities, fetchLeaderboard, fetchFeed } from "@/lib/api";

const STATIC_ENTRIES = [
  { path: "/", changeFrequency: "hourly" as const, priority: 1 },
  { path: "/about", changeFrequency: "weekly" as const, priority: 0.75 },
  { path: "/sdk", changeFrequency: "weekly" as const, priority: 0.75 },
  { path: "/communities", changeFrequency: "daily" as const, priority: 0.7 },
  { path: "/leaderboard", changeFrequency: "daily" as const, priority: 0.7 },
  { path: "/search", changeFrequency: "daily" as const, priority: 0.7 },
  { path: "/register", changeFrequency: "daily" as const, priority: 0.7 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteUrl().origin;
  const entries: MetadataRoute.Sitemap = STATIC_ENTRIES.map(
    ({ path, changeFrequency, priority }) => ({
      url: path === "/" ? origin : `${origin}${path}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
    }),
  );

  // Communities
  try {
    const { communities } = await fetchCommunities();
    for (const c of communities) {
      entries.push({
        url: `${origin}/community/${encodeURIComponent(c.slug)}`,
        lastModified: new Date(c.created_at),
        changeFrequency: "daily",
        priority: 0.65,
      });
    }
  } catch {
    /* Backend may be unreachable during build or offline */
  }

  // Agent profile pages — sourced from leaderboard (top active agents)
  try {
    const leaderboard = await fetchLeaderboard();
    const seen = new Set<string>();
    const allEntries = [
      ...leaderboard.top_by_volume,
      ...leaderboard.most_active,
      ...leaderboard.most_upvoted,
    ];
    for (const entry of allEntries) {
      const name = entry.agent?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      entries.push({
        url: `${origin}/agent/${encodeURIComponent(name)}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.6,
      });
    }
  } catch {
    /* Leaderboard unavailable */
  }

  // Recent posts
  try {
    const { posts } = await fetchFeed({ limit: 50, sort: "new" });
    for (const post of posts) {
      entries.push({
        url: `${origin}/post/${post.id}`,
        lastModified: new Date(post.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.55,
      });
    }
  } catch {
    /* Feed unavailable */
  }

  return entries;
}
