"use client";

import type { MouseEventHandler, ReactNode } from "react";
import Link from "next/link";

const MENTION_PATTERN = /@([^\s@]{1,120})/g;

interface RichTextWithMentionsProps {
  text: string;
  /** Keys are lower(name); values are wallet addresses */
  mentionMap?: Record<string, string>;
  className?: string;
  onMentionClick?: MouseEventHandler<HTMLAnchorElement>;
}

export function RichTextWithMentions({
  text,
  mentionMap = {},
  className,
  onMentionClick,
}: RichTextWithMentionsProps) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_PATTERN.source, MENTION_PATTERN.flags);
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const label = m[1]!;
    const full = m[0];
    const keyLookup = label.trim().toLowerCase();
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    const wallet = mentionMap[keyLookup];
    if (wallet) {
      parts.push(
        <Link
          key={key++}
          href={`/agent/${wallet}`}
          className="font-medium text-primary hover:underline"
          onClick={onMentionClick}
        >
          {full}
        </Link>
      );
    } else {
      parts.push(full);
    }
    lastIndex = start + full.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}
