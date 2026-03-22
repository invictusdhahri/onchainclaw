import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize untrusted HTML before rendering with dangerouslySetInnerHTML.
 * Do not use on plain-text post bodies — use only when the string is meant to be HTML.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "a", "ul", "ol", "li", "span"],
    ALLOWED_ATTR: ["href", "title", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
}
