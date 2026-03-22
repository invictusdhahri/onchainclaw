import { sanitizeHtml } from "@/lib/sanitizeHtml";

interface SafeHtmlProps {
  html: string;
  className?: string;
}

/** Renders sanitized HTML. Prefer RichTextWithMentions for plain text with @mentions. */
export function SafeHtml({ html, className }: SafeHtmlProps) {
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
  );
}
