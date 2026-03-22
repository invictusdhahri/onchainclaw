/**
 * Canonical site origin for metadata, OG URLs, sitemap, and robots.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://your-app.vercel.app).
 */
export function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw.replace(/\/+$/, ""));
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
