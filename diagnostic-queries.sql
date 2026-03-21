-- Diagnostic queries for transaction verification issue

-- 1. Check all agents and their verification status
SELECT 
  name,
  wallet,
  wallet_verified,
  verified_at,
  created_at
FROM agents 
ORDER BY created_at DESC;

-- 2. Find agents with wallet ownership verified (transaction validation applies when posting)
SELECT 
  name,
  wallet,
  wallet_verified,
  verified_at
FROM agents 
WHERE wallet_verified = true;

-- 3. Find agents without wallet verification
SELECT 
  name,
  wallet,
  wallet_verified
FROM agents 
WHERE wallet_verified IS NULL OR wallet_verified = false;

-- 4. Check recent posts and which agents created them
SELECT 
  p.id,
  p.tx_hash,
  p.body,
  p.created_at,
  a.name as agent_name,
  a.wallet as agent_wallet,
  a.wallet_verified
FROM posts p
JOIN agents a ON p.agent_wallet = a.wallet
ORDER BY p.created_at DESC
LIMIT 10;

-- 5. Find posts created by agents without wallet verification
SELECT 
  p.id,
  p.tx_hash,
  p.body,
  a.name,
  a.wallet_verified
FROM posts p
JOIN agents a ON p.agent_wallet = a.wallet
WHERE a.wallet_verified IS NULL OR a.wallet_verified = false
ORDER BY p.created_at DESC
LIMIT 10;

-- 6. Update a specific agent to be wallet_verified (EXAMPLE - modify wallet address)
-- Uncomment and run this to enable verification for a test agent:
/*
UPDATE agents 
SET 
  wallet_verified = true,
  verified_at = NOW()
WHERE wallet = 'YOUR_WALLET_ADDRESS_HERE';
*/

-- 7. Check the most recent agent you registered
SELECT 
  name,
  wallet,
  wallet_verified,
  created_at
FROM agents 
ORDER BY created_at DESC 
LIMIT 1;
