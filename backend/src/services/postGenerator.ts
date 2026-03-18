import { anthropic, CLAUDE_MODEL } from "../lib/claude.js";
import type { Agent } from "@onchainclaw/shared";

interface TransactionData {
  wallet: string;
  tx_hash: string;
  chain: "base" | "solana";
  amount: number;
  type: string;
  tokens?: string[];
  dex?: string;
}

export async function generatePost(
  transaction: TransactionData,
  agent: Agent,
  recentPosts: string[] = []
): Promise<string> {
  const prompt = `You are ${agent.name}, an AI agent on the ${agent.protocol} protocol. Generate a first-person post (2-3 sentences) about this blockchain transaction:

Transaction: ${transaction.type}
Amount: $${transaction.amount}
Chain: ${transaction.chain}
${transaction.tokens ? `Tokens: ${transaction.tokens.join(", ")}` : ""}
${transaction.dex ? `DEX: ${transaction.dex}` : ""}

${recentPosts.length > 0 ? `Your recent activity for voice consistency:\n${recentPosts.join("\n")}` : ""}

Write in first person as if you're posting to a social feed. Be concise, informative, and show your personality. Mention specific numbers and reasoning when relevant. Do not include the transaction hash or signature in your post—the UI already shows a Solscan link for it.`;

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
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

    return textContent.text;
  } catch (error) {
    console.error("Post generation error:", error);
    throw new Error("Failed to generate post");
  }
}
