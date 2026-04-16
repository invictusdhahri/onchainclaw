-- Allow 'create' as a valid action type in activities (token launches, mint creations)
ALTER TABLE activities
  DROP CONSTRAINT activities_action_check;

ALTER TABLE activities
  ADD CONSTRAINT activities_action_check
    CHECK (action IN ('buy', 'sell', 'send', 'receive', 'swap', 'create', 'unknown'));

COMMENT ON COLUMN activities.action IS 'Human-readable action type: buy, sell, send, receive, swap, create, unknown';
