-- Initialisation du schema `app` et tables principales
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION postgres;

-- Roles
CREATE TABLE IF NOT EXISTS app.roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- Users
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- User <-> Role (many-to-many)
CREATE TABLE IF NOT EXISTS app.user_roles (
  user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES app.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Categories
CREATE TABLE IF NOT EXISTS app.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id INT REFERENCES app.categories(id) ON DELETE SET NULL
);

-- Products
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

-- Product images
CREATE TABLE IF NOT EXISTS app.product_images (
  id SERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES app.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  position INT DEFAULT 0
);

-- Orders
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

-- Order items
CREATE TABLE IF NOT EXISTS app.order_items (
  id SERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES app.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES app.products(id),
  product_name TEXT,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INT NOT NULL,
  total NUMERIC(12,2) NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS app.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES app.orders(id) ON DELETE CASCADE,
  provider TEXT,
  provider_payment_id TEXT,
  amount NUMERIC(12,2),
  status TEXT,
  paid_at TIMESTAMPTZ
);

-- Carts
CREATE TABLE IF NOT EXISTS app.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.cart_items (
  id SERIAL PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES app.carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES app.products(id),
  quantity INT NOT NULL DEFAULT 1
);

-- Posts (blog)
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

-- Comments
CREATE TABLE IF NOT EXISTS app.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES app.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app.users(id),
  content TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS app.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES app.users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attachments
CREATE TABLE IF NOT EXISTS app.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  size BIGINT,
  uploaded_by UUID REFERENCES app.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: update updated_at
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Shared history logger (from user's snippet)
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
    pk := COALESCE(OLD.id::text, OLD.ID::text, OLD.id_user::text, OLD.uuid::text, NULLIF('', ''));
    changed := jsonb_build_object('before', old_row);
  ELSIF (TG_OP = 'INSERT') THEN
    old_row := NULL;
    new_row := to_jsonb(NEW);
    pk := COALESCE(NEW.id::text, NEW.ID::text, NEW.id_user::text, NEW.uuid::text, NULLIF('', ''));
    changed := jsonb_build_object('after', new_row);
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
  EXECUTE format('INSERT INTO %s (operation, changed_at, changed_by, table_name, row_id, row_data, changed_fields, query)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
                 hist_table)
  USING TG_OP, now(), current_user_id::uuid, TG_TABLE_NAME, pk, COALESCE(new_row, old_row), changed, NULL;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Historique manquant pour % - operation ignored', hist_table;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Create per-table history tables (lightweight generic structure)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='app' AND tablename='products_history') THEN
    CREATE TABLE app.products_history (
      id BIGSERIAL PRIMARY KEY,
      operation TEXT,
      changed_at TIMESTAMPTZ,
      changed_by UUID,
      table_name TEXT,
      row_id TEXT,
      row_data JSONB,
      changed_fields JSONB,
      query TEXT
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='app' AND tablename='users_history') THEN
    CREATE TABLE app.users_history ( LIKE app.products_history INCLUDING ALL );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='app' AND tablename='orders_history') THEN
    CREATE TABLE app.orders_history ( LIKE app.products_history INCLUDING ALL );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='app' AND tablename='categories_history') THEN
    CREATE TABLE app.categories_history ( LIKE app.products_history INCLUDING ALL );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='app' AND tablename='posts_history') THEN
    CREATE TABLE app.posts_history ( LIKE app.products_history INCLUDING ALL );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='app' AND tablename='comments_history') THEN
    CREATE TABLE app.comments_history ( LIKE app.products_history INCLUDING ALL );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='app' AND tablename='attachments_history') THEN
    CREATE TABLE app.attachments_history ( LIKE app.products_history INCLUDING ALL );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='app' AND tablename='carts_history') THEN
    CREATE TABLE app.carts_history ( LIKE app.products_history INCLUDING ALL );
  END IF;
END$$;

-- Attach triggers to log history for important tables
CREATE TRIGGER log_products_history
AFTER INSERT OR UPDATE OR DELETE ON app.products
FOR EACH ROW EXECUTE FUNCTION app.log_table_history();

CREATE TRIGGER log_users_history
AFTER INSERT OR UPDATE OR DELETE ON app.users
FOR EACH ROW EXECUTE FUNCTION app.log_table_history();

CREATE TRIGGER log_orders_history
AFTER INSERT OR UPDATE OR DELETE ON app.orders
FOR EACH ROW EXECUTE FUNCTION app.log_table_history();

CREATE TRIGGER log_categories_history
AFTER INSERT OR UPDATE OR DELETE ON app.categories
FOR EACH ROW EXECUTE FUNCTION app.log_table_history();

CREATE TRIGGER log_posts_history
AFTER INSERT OR UPDATE OR DELETE ON app.posts
FOR EACH ROW EXECUTE FUNCTION app.log_table_history();

CREATE TRIGGER log_comments_history
AFTER INSERT OR UPDATE OR DELETE ON app.comments
FOR EACH ROW EXECUTE FUNCTION app.log_table_history();

CREATE TRIGGER log_attachments_history
AFTER INSERT OR UPDATE OR DELETE ON app.attachments
FOR EACH ROW EXECUTE FUNCTION app.log_table_history();

CREATE TRIGGER log_carts_history
AFTER INSERT OR UPDATE OR DELETE ON app.carts
FOR EACH ROW EXECUTE FUNCTION app.log_table_history();

-- set_updated_at trigger example for products
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON app.products
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Sessions, settings and other helpers (minimal)
CREATE TABLE IF NOT EXISTS app.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app.users(id) ON DELETE CASCADE,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- End of init schema
