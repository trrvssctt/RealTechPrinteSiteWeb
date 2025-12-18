-- migrate_app_user.sql
-- Migration script intended to be run by a normal DB user that already
-- has a database and adequate privileges. This script DOES NOT create roles
-- or the database itself. It creates schema `app`, extensions (if permitted),
-- tables and triggers used by the application.

-- IMPORTANT:
-- - If you do NOT have permission to create extensions (pgcrypto) ask your
--   hosting provider to enable them (pgcrypto is required for gen_random_uuid()).
-- - Always backup your database before running a migration on production.

/* ========== Extensions ========== */
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";

/* ========== Schema ========== */
CREATE SCHEMA IF NOT EXISTS app;

SET search_path = app, public;

/* ========== Tables (core) ========== */
-- roles
CREATE TABLE IF NOT EXISTS app.roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- users
CREATE TABLE IF NOT EXISTS app.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- user_roles
CREATE TABLE IF NOT EXISTS app.user_roles (
  user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES app.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- categories
CREATE TABLE IF NOT EXISTS app.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id INT REFERENCES app.categories(id) ON DELETE SET NULL
);

-- products
CREATE TABLE IF NOT EXISTS app.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  category_id INT REFERENCES app.categories(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON app.products (slug);
CREATE INDEX IF NOT EXISTS idx_products_price ON app.products (price);
CREATE INDEX IF NOT EXISTS idx_products_active_stock ON app.products (is_active, stock);

-- product_images
CREATE TABLE IF NOT EXISTS app.product_images (
  id SERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES app.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  position INT DEFAULT 0
);

-- orders
CREATE TABLE IF NOT EXISTS app.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app.users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount NUMERIC(12,2) NOT NULL,
  placed_at TIMESTAMPTZ DEFAULT now(),
  shipping_address JSONB,
  billing_address JSONB,
  metadata JSONB
);

-- order_items
CREATE TABLE IF NOT EXISTS app.order_items (
  id SERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES app.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES app.products(id),
  product_name TEXT,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INT NOT NULL,
  total NUMERIC(12,2) NOT NULL
);

-- payments
CREATE TABLE IF NOT EXISTS app.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES app.orders(id) ON DELETE CASCADE,
  provider TEXT,
  provider_payment_id TEXT,
  amount NUMERIC(12,2),
  status TEXT,
  paid_at TIMESTAMPTZ
);

-- carts
CREATE TABLE IF NOT EXISTS app.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app.users(id),
  session_id TEXT,
  status TEXT DEFAULT 'active',
  items JSONB,
  total_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- cart_items (optional; used by some controllers)
CREATE TABLE IF NOT EXISTS app.cart_items (
  id SERIAL PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES app.carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES app.products(id),
  name TEXT,
  price NUMERIC(12,2),
  quantity INT NOT NULL DEFAULT 1,
  image TEXT,
  category TEXT
);

-- posts
CREATE TABLE IF NOT EXISTS app.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES app.users(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT,
  excerpt TEXT,
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- comments
CREATE TABLE IF NOT EXISTS app.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES app.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app.users(id),
  content TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- audit_logs
CREATE TABLE IF NOT EXISTS app.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES app.users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- attachments
CREATE TABLE IF NOT EXISTS app.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  size BIGINT,
  uploaded_by UUID REFERENCES app.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- settings
CREATE TABLE IF NOT EXISTS app.settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

/* ========== Trigger and history functions ========== */
-- set_updated_at
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- generic history logger (best-effort)
CREATE OR REPLACE FUNCTION app.log_table_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  hist_table text;
  pk text;
  old_row jsonb;
  new_row jsonb;
  changed jsonb;
  current_user_id text;
BEGIN
  hist_table := format('app.%s_history', TG_TABLE_NAME);
  current_user_id := current_setting('app.current_user_id', true);

  IF (TG_OP = 'DELETE') THEN
    old_row := to_jsonb(OLD);
    new_row := NULL;
    pk := COALESCE(old_row->>'id', old_row->>'ID', old_row->>'uuid', NULL);
    changed := jsonb_build_object('before', old_row);
  ELSIF (TG_OP = 'INSERT') THEN
    old_row := NULL;
    new_row := to_jsonb(NEW);
    pk := COALESCE(new_row->>'id', new_row->>'ID', new_row->>'uuid', NULL);
    changed := jsonb_build_object('after', new_row);
  ELSIF (TG_OP = 'UPDATE') THEN
    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);
    pk := COALESCE(new_row->>'id', new_row->>'ID', new_row->>'uuid', NULL);
    changed := (
      SELECT jsonb_object_agg(k, jsonb_build_object('old', old_row->k, 'new', new_row->k))
      FROM (
        SELECT jsonb_object_keys(new_row) AS k
      ) s
      WHERE (old_row->s.k IS DISTINCT FROM new_row->s.k)
    );
  ELSE
    RETURN NULL;
  END IF;

  BEGIN
    EXECUTE format('INSERT INTO %s (operation, changed_at, changed_by, table_name, row_id, row_data, changed_fields, query)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', hist_table)
    USING TG_OP, now(), current_user_id::uuid, TG_TABLE_NAME, pk, COALESCE(new_row, old_row), changed, NULL;
  EXCEPTION WHEN undefined_table THEN
    -- ignore missing history table
    RAISE NOTICE 'History table % does not exist - skipping', hist_table;
  END;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- create history tables for main objects (if they don't exist)
DO $$
DECLARE
  tables text[] := ARRAY[
    'roles','users','user_roles','categories','products','product_images',
    'orders','order_items','payments','carts','cart_items',
    'posts','comments','audit_logs','attachments','settings'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS app.%1$s_history (
        history_id BIGSERIAL PRIMARY KEY,
        operation TEXT NOT NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        changed_by UUID,
        table_name TEXT NOT NULL,
        row_id TEXT,
        row_data JSONB,
        changed_fields JSONB,
        query TEXT
      );', t);
  END LOOP;
END $$;

-- attach triggers for history and updated_at where applicable
DO $$
DECLARE
  t text;
BEGIN
  t := 'products';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name=t AND column_name='updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_products_set_updated_at ON app.products';
    EXECUTE 'CREATE TRIGGER trg_products_set_updated_at BEFORE UPDATE ON app.products FOR EACH ROW EXECUTE FUNCTION app.set_updated_at()';
  END IF;

  -- attach generic history trigger to a short list (you can expand)
  FOR t IN SELECT unnest(ARRAY['products','users','orders','categories','posts','comments','carts','attachments']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_history ON app.%s', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_history AFTER INSERT OR UPDATE OR DELETE ON app.%s FOR EACH ROW EXECUTE FUNCTION app.log_table_history()', t, t);
  END LOOP;
END $$;

-- grant minimal privileges to the current user (best-effort)
-- Note: in many managed hosts you won't be able to change grants broadly.
GRANT USAGE ON SCHEMA app TO public;

-- End of migration
