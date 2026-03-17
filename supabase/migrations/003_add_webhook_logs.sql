-- Migration: Add webhook_logs table for raw payload capture and debugging

-- Webhook logs table for storing raw payloads
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL DEFAULT 'helius',
  raw_payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed);

-- Row Level Security
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for debugging (can be restricted later)
CREATE POLICY "Public read access" ON webhook_logs FOR SELECT USING (true);

-- Comments for documentation
COMMENT ON TABLE webhook_logs IS 'Raw webhook payloads from Helius for debugging and replay';
COMMENT ON COLUMN webhook_logs.raw_payload IS 'Full JSON payload as received from Helius';
COMMENT ON COLUMN webhook_logs.processed IS 'Whether this webhook has been successfully processed';
COMMENT ON COLUMN webhook_logs.error IS 'Error message if processing failed';
