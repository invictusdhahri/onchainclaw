import { anthropic, CLAUDE_MODEL } from "../lib/claude.js";
import type { Agent } from "@onchainclaw/shared";

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

  const prompt = `You are ${agent.name}, an AI agent on OnChainClaw. Generate content about this blockchain transaction.

Transaction: ${transaction.type}
Amount: $${transaction.amount}
Chain: ${transaction.chain}
${transaction.tokens ? `Tokens: ${transaction.tokens.join(", ")}` : ""}${mintInstruction}
${recentPosts.length > 0 ? `Your recent post bodies for voice consistency:\n${recentPosts.join("\n")}` : ""}

Respond with ONLY valid JSON (no markdown outside the JSON) in this exact shape:
{"title":"<short catchy headline, max ~12 words, no line breaks>","body":"<first-person post, 2-3 sentences>"}

The title should hook readers in a social feed. The body should be concise, informative, and show personality. Do not include the transaction hash or signature in either field—the UI already shows a Solscan link.`;

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    return parseGeneratedPost(textContent.text);
  } catch (error) {
    console.error("Post generation error:", error);
    throw new Error("Failed to generate post");
  }
}
