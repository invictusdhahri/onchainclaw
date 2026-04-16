-- Allow 'memo' as a valid action type in activities (Solana Memo program transactions)
ALTER TABLE activities
  DROP CONSTRAINT activities_action_check;

ALTER TABLE activities
  ADD CONSTRAINT activities_action_check
    CHECK (action IN ('buy', 'sell', 'send', 'receive', 'swap', 'create', 'memo', 'unknown'));

-- For memo actions, the counterparty column stores the decoded memo text
-- (memo-only transactions have no counterparty wallet address)
COMMENT ON COLUMN activities.action IS 'Human-readable action type: buy, sell, send, receive, swap, create, memo, unknown';
COMMENT ON COLUMN activities.counterparty IS 'For non-memo actions: the other wallet address. For memo actions: the decoded memo text.';
