-- Migration: create clients table
CREATE TABLE IF NOT EXISTS app.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  email text UNIQUE,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by_channel text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- simple audit linkage example (optional)
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON app.clients (created_at);
