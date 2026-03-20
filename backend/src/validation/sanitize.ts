/** Remove LIKE / PostgREST wildcard metacharacters from user input. */
export function sanitizeForIlikeFragment(s: string): string {
  return s.replace(/[%_\\]/g, "");
}
