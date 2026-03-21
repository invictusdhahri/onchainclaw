"use client";

import type { MouseEventHandler, ReactNode } from "react";
import Link from "next/link";
import { AgentHoverPreview } from "@/components/AgentHoverPreview";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { SplMintChip } from "@/components/SplMintChip";
import { splitTextBySolanaMints } from "@/lib/solanaMint";

const MENTION_PATTERN = /@([^\s@]{1,120})/g;

interface RichTextWithMentionsProps {
  text: string;
  /** Keys are lower(name); values are wallet addresses */
  mentionMap?: Record<string, string>;
  className?: string;
  onMentionClick?: MouseEventHandler<HTMLAnchorElement>;
  /** When true, hovering a resolved @mention opens an agent preview card */
  mentionHoverPreview?: boolean;
}

type MentionSegment =
  | { kind: "text"; s: string }
  | { kind: "mention"; label: string; full: string; wallet: string | undefined };

function segmentByMentions(text: string, mentionMap: Record<string, string>): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_PATTERN.source, MENTION_PATTERN.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const label = m[1]!;
    const full = m[0];
    const keyLookup = label.trim().toLowerCase();
    if (start > lastIndex) {
      segments.push({ kind: "text", s: text.slice(lastIndex, start) });
    }
    segments.push({
      kind: "mention",
      label,
      full,
      wallet: mentionMap[keyLookup],
    });
    lastIndex = start + full.length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: "text", s: text.slice(lastIndex) });
  }
  return segments;
}

export function RichTextWithMentions({
  text,
  mentionMap = {},
  className,
  onMentionClick,
  mentionHoverPreview = true,
}: RichTextWithMentionsProps) {
  const segments = segmentByMentions(text, mentionMap);
  const parts: ReactNode[] = [];
  let key = 0;

  for (const seg of segments) {
    if (seg.kind === "mention") {
      const { full, wallet } = seg;
      if (wallet) {
        const link = (
          <Link
            href={`/agent/${wallet}`}
            className="font-medium text-primary hover:underline"
            onClick={onMentionClick}
          >
            {full}
          </Link>
        );
        parts.push(
          mentionHoverPreview ? (
            <HoverCard key={key++} openDelay={220} closeDelay={80}>
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
            <span key={key++}>{link}</span>
          )
        );
      } else {
        parts.push(full);
      }
      continue;
    }

    const mintPieces = splitTextBySolanaMints(seg.s);
    for (const piece of mintPieces) {
      if (piece.kind === "text") {
        if (piece.value.length > 0) {
          parts.push(piece.value);
        }
      } else {
        parts.push(<SplMintChip key={`mint-${key++}-${piece.mint}`} mint={piece.mint} />);
      }
    }
  }

  return <span className={className}>{parts}</span>;
}
