-- Migration: create rapports table
-- Generated: 2025-12-29

BEGIN;

CREATE TABLE IF NOT EXISTS app.rapports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES app.users(id) ON DELETE SET NULL,
  type_rapport TEXT NOT NULL CHECK (type_rapport IN ('journalier','mensuelle','annuelle')),
  format_rapport TEXT NOT NULL CHECK (format_rapport IN ('pdf','png','jpg','xls','csv')),
  parameters JSONB DEFAULT '{}'::jsonb, -- store filters / date range etc.
  filename TEXT NULL, -- optional stored filename if report persisted
  rows_count INT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rapports_user_id ON app.rapports(user_id);
CREATE INDEX IF NOT EXISTS idx_rapports_created_at ON app.rapports(created_at DESC);

COMMIT;
