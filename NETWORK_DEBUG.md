# Transaction Verification Network Issue - Troubleshooting

## Problem
The backend can't reach Helius API from Node.js, but curl works fine (albeit slowly - 31 seconds).

## Current Status
- ❌ Node.js fetch: Fails after ~10 seconds with "fetch failed"
- ✅ curl: Works but takes 31 seconds
- ✅ Helius API: Returns correct data with wallet properly identified

## Possible Causes

### 1. Node.js Fetch Limitations
Node's built-in fetch might have different timeout/connection handling than curl.

### 2. Network/Firewall Configuration
Your network might have:
- Connection pooling limits
- DNS resolution issues
- Proxy requirements
- Firewall rules blocking Node.js but not curl

### 3. Geographic Latency
The 30+ second response time suggests you might be far from Helius servers or have high latency.

## Solutions

### Option 1: Temporarily Disable Verification (for testing)

Add to your `backend/.env`:
```bash
DISABLE_TX_VERIFICATION=true
```

This will bypass verification entirely while you debug the network issue.

### Option 2: Use Solana RPC Instead of Helius

Instead of using Helius parsed transactions API, we can fetch directly from Solana RPC which might be faster:

```typescript
// Alternative using Solana RPC
const response = await fetch(`https://api.mainnet-beta.solana.com`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: [
      txHash,
      {
        encoding: 'json',
        maxSupportedTransactionVersion: 0
      }
    ]
  })
});
```

### Option 3: Install and Use axios

```bash
cd backend
pnpm add axios
```

Then replace fetch with axios which has better timeout handling:

```typescript
import axios from 'axios';

const response = await axios.post(
  `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`,
  { transactions: [txHash] },
  { 
    timeout: 40000,
    headers: { 'Content-Type': 'application/json' }
  }
);
```

### Option 4: Use Your Own Helius RPC Endpoint

Instead of the transactions API, use your Helius RPC directly:

```typescript
const response = await fetch(
  `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [
        txHash,
        {
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        }
      ]
    })
  }
);
```

## Recommended Immediate Fix

For now, add this to your `.env` to allow posts while we debug:

```bash
DISABLE_TX_VERIFICATION=true
```

Then test posting - it should work immediately. This proves the rest of your system is working.

## Next Steps

1. Try posting with verification disabled
2. We'll implement Option 4 (Helius RPC) which should be faster
3. Add proper error handling for slow networks
4. Consider caching verification results

## Testing Commands

```bash
# Test 1: With verification disabled
echo "DISABLE_TX_VERIFICATION=true" >> backend/.env
# Restart backend and try posting

# Test 2: Check DNS resolution
nslookup api.helius.xyz

# Test 3: Check if proxy is needed
env | grep -i proxy

# Test 4: Test direct Helius RPC
curl -X POST "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getTransaction","params":["YOUR_TX_HASH",{"encoding":"json"}]}'
```
