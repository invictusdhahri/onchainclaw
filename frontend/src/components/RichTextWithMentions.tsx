"use client";

import type { MouseEventHandler, ReactNode } from "react";
import Link from "next/link";
import { AgentHoverPreview } from "@/components/AgentHoverPreview";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { SplMintChip } from "@/components/SplMintChip";
import { agentProfilePath } from "@/lib/agentProfilePath";

/**
 * Combined inline token regex — matches in priority order:
 *  1. @mention
 *  2. [label](url) markdown link
 *  3. **bold**
 *  4. *italic* (single asterisk, no nested *)
 *  5. _italic_ (underscore, no nested _)
 *  6. bare https?:// URL
 *  7. Solana mint (base58, 32–48 chars)
 */
const INLINE_RE =
  /(@[^\s@]{1,120})|\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|\*\*(.+?)\*\*|\*([^*\n]+?)\*|_([^_\n]+?)_|(https?:\/\/\S+)|(?<![1-9A-HJ-NP-Za-km-z])([1-9A-HJ-NP-Za-km-z]{32,48})(?![1-9A-HJ-NP-Za-km-z])/g;

export type InlineSegment =
  | { kind: "text"; value: string }
  | { kind: "mention"; full: string; label: string; wallet: string | undefined }
  | { kind: "link"; label: string; url: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "url"; url: string }
  | { kind: "mint"; mint: string };

/** Parse a flat string into typed inline segments. */
export function parseInlineSegments(
  text: string,
  mentionMap: Record<string, string>
): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const re = new RegExp(INLINE_RE.source, INLINE_RE.flags);
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ kind: "text", value: text.slice(last, m.index) });
    }

    if (m[1] !== undefined) {
      const full = m[1];
      const label = full.slice(1);
      segments.push({ kind: "mention", full, label, wallet: mentionMap[label.toLowerCase()] });
    } else if (m[2] !== undefined) {
      segments.push({ kind: "link", label: m[2], url: m[3]! });
    } else if (m[4] !== undefined) {
      segments.push({ kind: "bold", value: m[4] });
    } else if (m[5] !== undefined) {
      segments.push({ kind: "italic", value: m[5] });
    } else if (m[6] !== undefined) {
      segments.push({ kind: "italic", value: m[6] });
    } else if (m[7] !== undefined) {
      segments.push({ kind: "url", url: m[7] });
    } else if (m[8] !== undefined) {
      segments.push({ kind: "mint", mint: m[8] });
    }

    last = m.index + m[0].length;
  }

  if (last < text.length) {
    segments.push({ kind: "text", value: text.slice(last) });
  }

  return segments;
}

export interface RenderInlineOpts {
  onMentionClick?: MouseEventHandler<HTMLAnchorElement>;
  mentionHoverPreview?: boolean;
}

/** Convert parsed inline segments to React nodes. */
export function renderInlineSegments(
  segments: InlineSegment[],
  opts: RenderInlineOpts = {}
): ReactNode[] {
  const { onMentionClick, mentionHoverPreview = true } = opts;
  const parts: ReactNode[] = [];
  let k = 0;

  for (const seg of segments) {
    const key = k++;

    switch (seg.kind) {
      case "text":
        if (seg.value) parts.push(seg.value);
        break;

      case "mention": {
        const { full, label, wallet } = seg;
        if (wallet) {
          const link = (
            <Link
              key={key}
              href={agentProfilePath(label)}
              className="font-medium text-primary hover:underline"
              onClick={onMentionClick}
            >
              {full}
            </Link>
          );
          parts.push(
            mentionHoverPreview ? (
              <HoverCard key={key} openDelay={220} closeDelay={80}>
                <HoverCardTrigger asChild>{link}</HoverCardTrigger>
                <HoverCardContent
                  side="top"
                  align="start"
                  className="w-80"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <AgentHoverPreview wallet={wallet} />
                </HoverCardContent>
              </HoverCard>
            ) : (
              link
            )
          );
        } else {
          parts.push(full);
        }
        break;
      }

      case "link":
        parts.push(
          <a
            key={key}
            href={seg.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {seg.label}
          </a>
        );
        break;

      case "bold":
        parts.push(<strong key={key}>{seg.value}</strong>);
        break;

      case "italic":
        parts.push(<em key={key}>{seg.value}</em>);
        break;

      case "url":
        parts.push(
          <a
            key={key}
            href={seg.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {seg.url}
          </a>
        );
        break;

      case "mint":
        parts.push(<SplMintChip key={key} mint={seg.mint} />);
        break;
    }
  }

  return parts;
}

interface RichTextWithMentionsProps {
  text: string;
  /** Keys are lower(name); values are wallet addresses */
  mentionMap?: Record<string, string>;
  className?: string;
  onMentionClick?: MouseEventHandler<HTMLAnchorElement>;
  /** When true, hovering a resolved @mention opens an agent preview card */
  mentionHoverPreview?: boolean;
}

export function RichTextWithMentions({
  text,
  mentionMap = {},
  className,
  onMentionClick,
  mentionHoverPreview = true,
}: RichTextWithMentionsProps) {
  const segments = parseInlineSegments(text, mentionMap);
  const parts = renderInlineSegments(segments, { onMentionClick, mentionHoverPreview });
  return <span className={className}>{parts}</span>;
}
