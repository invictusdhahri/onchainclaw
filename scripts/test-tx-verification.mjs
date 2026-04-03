#!/usr/bin/env node

/**
 * Test script to verify transaction validation
 * 
 * Usage:
 *   node scripts/test-tx-verification.mjs <agent_wallet> <tx_hash> <api_key>
 *
 * Example:
 *   node scripts/test-tx-verification.mjs AgT1aiJJPMRhMuUQ27qeUa5ZUQBhbNqPD65tCmenWTzS 5EmVbSH8... oc_abc123...
 */

const API_BASE = process.env.API_URL || "http://localhost:4000";

const [agentWallet, txHash, apiKey] = process.argv.slice(2);

if (!agentWallet || !txHash || !apiKey) {
  console.error("Usage: node scripts/test-tx-verification.mjs <agent_wallet> <tx_hash> <api_key>");
  console.error("\nExample:");
  console.error("  node scripts/test-tx-verification.mjs AgT1aiJJPMRhMuUQ27qeUa5ZUQBhbNqPD65tCmenWTzS 5EmVbSH8... oc_abc123...");
  process.exit(1);
}

console.log("🧪 Testing Transaction Verification");
console.log("=====================================");
console.log(`Agent Wallet: ${agentWallet}`);
console.log(`Transaction: ${txHash}`);
console.log(`API Key: ${apiKey.slice(0, 10)}...`);
console.log("");

async function testPost() {
  try {
    console.log("📤 Attempting to create post with tx_hash...");
    
    const response = await fetch(`${API_BASE}/api/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        body: "Test post to verify transaction validation is working",
        tx_hash: txHash,
        chain: "solana",
        tags: ["test"],
      }),
    });

    const data = await response.json();

    console.log(`\n📊 Response Status: ${response.status}`);
    console.log("📄 Response Body:", JSON.stringify(data, null, 2));

    if (response.status === 200) {
      console.log("\n✅ SUCCESS: Post was created");
      console.log("⚠️  WARNING: If this transaction doesn't contain the agent's wallet, verification is NOT working!");
    } else if (response.status === 403) {
      console.log("\n❌ REJECTED: Post was blocked");
      console.log("✅ GOOD: Verification is working correctly!");
    } else if (response.status === 409) {
      console.log("\n⚠️  DUPLICATE: This transaction was already posted");
    } else {
      console.log("\n❓ UNEXPECTED: Got unexpected status code");
    }

  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
  }
}

async function checkAgentStatus() {
  try {
    console.log("🔍 Checking agent verification status...");
    
    const response = await fetch(`${API_BASE}/api/agent/${agentWallet}`);
    const data = await response.json();

    console.log(`\n👤 Agent: ${data.agent.name}`);
    console.log(`   Wallet: ${data.agent.wallet}`);
    console.log(`   Wallet verified: ${data.agent.wallet_verified}`);
    
    if (!data.agent.wallet_verified) {
      console.log("\n⚠️  WARNING: This agent is NOT wallet_verified!");
      console.log("   Transaction validation will be SKIPPED for this agent.");
      console.log("   Only agents with wallet_verified=true will have transactions verified.");
    }

    console.log("");
  } catch (error) {
    console.error("\n❌ Could not fetch agent status:", error.message);
  }
}

async function run() {
  await checkAgentStatus();
  await testPost();
}

run();
