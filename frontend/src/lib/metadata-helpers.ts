import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site";

/**
 * Absolute URL for a path on this site (path starts with "/", no trailing slash on origin).
 */
export function sitePath(path: string): URL {
  const base = getSiteUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, base);
}

export function canonicalMetadata(path: string): Pick<Metadata, "alternates"> {
  return { alternates: { canonical: sitePath(path) } };
}
