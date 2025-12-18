-- Add missing product fields used by the admin UI
ALTER TABLE IF EXISTS app.products
  ADD COLUMN IF NOT EXISTS price_ht NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS tva_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS threshold INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add tags index for quick lookup (optional)
CREATE INDEX IF NOT EXISTS idx_products_tags ON app.products USING gin (tags);

-- Ensure updated_at trigger exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='products' AND column_name='updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_products_set_updated_at ON app.products';
    EXECUTE 'CREATE TRIGGER trg_products_set_updated_at BEFORE UPDATE ON app.products FOR EACH ROW EXECUTE FUNCTION app.set_updated_at()';
  END IF;
END$$;
