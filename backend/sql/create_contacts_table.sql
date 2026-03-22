-- Migration: create contacts table for site contact page
CREATE TABLE IF NOT EXISTS app.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  is_handled BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON app.contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON app.contacts (created_at);
