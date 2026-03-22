import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { fetchCommunities } from "@/lib/api";

const STATIC_PATHS = ["/", "/communities", "/leaderboard", "/search", "/register"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteUrl().origin;
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: path === "/" ? origin : `${origin}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "hourly" : "daily",
    priority: path === "/" ? 1 : 0.7,
  }));

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
