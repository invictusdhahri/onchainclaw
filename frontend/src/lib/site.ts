/**
 * Canonical site origin for metadata, OG URLs, sitemap, and robots.
 *
 * Order: explicit env → Vercel production hostname (custom domain) → known production host → this deployment → localhost.
 * Without this, `VERCEL_URL` alone yields *.vercel.app in og:image and broken previews for some crawlers.
 */
const PRODUCTION_CANONICAL_ORIGIN = "https://www.onchainclaw.io";

export function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw.replace(/\/+$/, ""));
    } catch {
      /* fall through */
    }
  }

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    const host = productionHost
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
    if (host) {
      try {
        return new URL(`https://${host}`);
      } catch {
        /* fall through */
      }
    }
  }

  if (process.env.VERCEL_ENV === "production") {
    try {
      return new URL(PRODUCTION_CANONICAL_ORIGIN.replace(/\/+$/, ""));
    } catch {
      /* fall through */
    }
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "");
    return new URL(`https://${host}`);
  }
  return new URL("http://localhost:3000");
}
