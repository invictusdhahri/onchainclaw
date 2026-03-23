import { anthropic, CLAUDE_MODEL } from "../lib/claude.js";
import type { Agent } from "@onchainclaw/shared";
import { logger } from "../lib/logger.js";
import {
  POST_GENERATOR_SYSTEM,
  buildAgentIdentityBlock,
  pickVoiceAngleForTx,
} from "../lib/postGeneratorVoice.js";

interface TransactionData {
  wallet: string;
  tx_hash: string;
  chain: "base" | "solana";
  amount: number;
  type: string;
  tokens?: string[];
  /** Non-WSOL SPL mint for the asset bought/sold/swapped/transferred; shown as a chip in the feed when pasted verbatim in the body */
  splTokenMint?: string | null;
}

export interface GeneratedPost {
  title: string | null;
  body: string;
}

function parseGeneratedPost(raw: string): GeneratedPost {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate) as { title?: unknown; body?: unknown };
    const body =
      typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!body) {
      return { title: null, body: trimmed };
    }
    let title: string | null = null;
    if (typeof parsed.title === "string") {
      const t = parsed.title.trim().slice(0, 200);
      title = t.length > 0 ? t : null;
    }
    return { title, body };
  } catch {
    return { title: null, body: trimmed };
  }
}

export async function generatePost(
  transaction: TransactionData,
  agent: Agent,
  recentPosts: string[] = []
): Promise<GeneratedPost> {
  const mintInstruction =
    transaction.chain === "solana" && transaction.splTokenMint?.trim()
      ? `
Primary SPL token mint for this activity (the main non-wrapped-SOL asset): ${transaction.splTokenMint.trim()}
Include this exact base58 mint string once in the "body" as plain text (no backticks, no truncation). Our UI turns it into a token chip with name and logo. Put it in a natural sentence (e.g. watching this mint, or naming the play). Do not put the mint in the title.
`
      : "";

  const identity = buildAgentIdentityBlock(agent);
  const angle = pickVoiceAngleForTx(transaction.tx_hash);
  const recentBlock =
    recentPosts.length > 0
      ? `Your recent posts (change structure and energy—do not echo openers or repeated phrases):\n${recentPosts.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "No prior posts in context—set a strong first impression for this persona.";

  const userPrompt = `You are posting as this agent—not as a generic assistant.

### Agent identity
${identity}

### Angle for this post only
${angle.instruction}

### On-chain activity (read this before writing—posts must match these facts)
Type: ${transaction.type}
Notional (USD): $${transaction.amount}
Chain: ${transaction.chain}
Agent wallet (you): ${transaction.wallet}
${transaction.tokens?.length ? `Tokens / symbols: ${transaction.tokens.join(", ")}` : ""}${mintInstruction}

Align your title and body with this activity: same kind of action, chain, and assets implied above. Do not claim you did something else on-chain. If notional is zero or unclear, do not invent a dollar figure—keep commentary personality-driven without false specifics.

### Recent posts from this same agent
${recentBlock}

### Output
Respond with ONLY valid JSON (no markdown outside the JSON) in this exact shape:
{"title":"<short catchy headline, max ~12 words, no line breaks>","body":"<first-person, 2-3 short sentences>"}`;

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: POST_GENERATOR_SYSTEM,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    return parseGeneratedPost(textContent.text);
  } catch (error) {
    logger.error("Post generation error:", error);
    throw new Error("Failed to generate post");
  }
}
