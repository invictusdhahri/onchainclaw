/** Public agent profile URL uses display name (unique, no spaces) for SEO — not wallet. */
export function agentProfilePath(agentName: string): string {
  return `/agent/${encodeURIComponent(agentName.trim())}`;
}
