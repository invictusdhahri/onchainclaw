"use client";

import type { MouseEventHandler, ReactNode } from "react";
import { parseInlineSegments, renderInlineSegments, type RenderInlineOpts } from "@/components/RichTextWithMentions";

interface RichMarkdownBodyProps {
  text: string;
  mentionMap?: Record<string, string>;
  className?: string;
  onMentionClick?: MouseEventHandler<HTMLAnchorElement>;
  mentionHoverPreview?: boolean;
}

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; lines: string[] };

/** Parse raw text into block-level elements. */
function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let currentPara: string[] | null = null;
  let currentList: string[] | null = null;

  const flushPara = () => {
    if (currentPara) {
      blocks.push({ type: "paragraph", lines: currentPara });
      currentPara = null;
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push({ type: "list", items: currentList });
      currentList = null;
    }
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    const listMatch = /^[-*]\s+(.+)$/.exec(line);
    const isBlank = line.trim() === "";

    if (headingMatch) {
      flushPara();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1]!.length as 1 | 2 | 3,
        text: headingMatch[2]!,
      });
    } else if (listMatch) {
      flushPara();
      if (!currentList) currentList = [];
      currentList.push(listMatch[1]!);
    } else if (isBlank) {
      flushPara();
      flushList();
    } else {
      flushList();
      if (!currentPara) currentPara = [];
      currentPara.push(line);
    }
  }

  flushPara();
  flushList();

  return blocks;
}

const HEADING_CLASSES: Record<1 | 2 | 3, string> = {
  1: "text-xl font-bold mt-4 mb-2 leading-snug",
  2: "text-lg font-semibold mt-3 mb-1 leading-snug",
  3: "text-base font-semibold mt-2 mb-1 leading-snug",
};

export function RichMarkdownBody({
  text,
  mentionMap = {},
  className,
  onMentionClick,
  mentionHoverPreview = true,
}: RichMarkdownBodyProps) {
  const opts: RenderInlineOpts = { onMentionClick, mentionHoverPreview };
  const blocks = parseBlocks(text);
  const nodes: ReactNode[] = [];
  let blockKey = 0;

  for (const block of blocks) {
    const key = blockKey++;

    if (block.type === "heading") {
      const Tag = `h${block.level}` as "h1" | "h2" | "h3";
      nodes.push(
        <Tag key={key} className={HEADING_CLASSES[block.level]}>
          {renderInlineSegments(parseInlineSegments(block.text, mentionMap), opts)}
        </Tag>
      );
    } else if (block.type === "list") {
      nodes.push(
        <ul key={key} className="list-disc list-inside space-y-0.5 my-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineSegments(parseInlineSegments(item, mentionMap), opts)}
            </li>
          ))}
        </ul>
      );
    } else {
      // paragraph — join lines with newline so whitespace-pre-wrap renders line breaks
      const content = block.lines.join("\n");
      nodes.push(
        <p key={key} className="leading-relaxed whitespace-pre-wrap">
          {renderInlineSegments(parseInlineSegments(content, mentionMap), opts)}
        </p>
      );
    }
  }

  return (
    <div className={className}>
      {nodes}
    </div>
  );
}
