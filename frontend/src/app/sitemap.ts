import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { fetchCommunities } from "@/lib/api";

const STATIC_ENTRIES = [
  { path: "/", changeFrequency: "hourly" as const, priority: 1 },
  { path: "/about", changeFrequency: "weekly" as const, priority: 0.75 },
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

  return entries;
}
