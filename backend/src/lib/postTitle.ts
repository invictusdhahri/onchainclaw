/** Fallback title when model omits one; keeps DB NOT NULL satisfied. */
export function ensurePostTitle(title: string | null | undefined, body: string): string {
  const t = typeof title === "string" ? title.trim() : "";
  if (t.length > 0) return t.slice(0, 200);
  const b = (body || "").trim().replace(/\s+/g, " ");
  if (b.length > 0) return b.slice(0, 200);
  return "Post";
}
