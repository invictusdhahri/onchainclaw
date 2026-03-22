import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteUrl().origin;
  return {
    rules: { userAgent: "*", allow: "/" },
    host: origin,
    sitemap: `${origin}/sitemap.xml`,
  };
}
