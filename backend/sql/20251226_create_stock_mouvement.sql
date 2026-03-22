-- Migration: create stock_mouvement table
-- Generated: 2025-12-26
-- Purpose: record inbound/outbound stock movements (used by admin Stock page)

BEGIN;

CREATE TABLE IF NOT EXISTS app.stock_mouvement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES app.products(id) ON DELETE RESTRICT,
  order_id UUID NULL REFERENCES app.orders(id) ON DELETE SET NULL,
  order_item_id INT NULL REFERENCES app.order_items(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in','out')),
  movement_subtype TEXT NOT NULL, -- e.g. 'reaprovisonnement','livraison','commande','annulation_commande','autre'
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NULL,
  reference TEXT NULL,
  related_movement_id UUID NULL REFERENCES app.stock_mouvement(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','voided')),
  cancel_reason TEXT NULL,
  created_by UUID NULL REFERENCES app.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_mouvement_product_id ON app.stock_mouvement (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvement_order_id ON app.stock_mouvement (order_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvement_created_at ON app.stock_mouvement (created_at DESC);

-- Optional constraint: out movements should reference a source (order) or have a meaningful subtype
ALTER TABLE app.stock_mouvement
  ADD CONSTRAINT IF NOT EXISTS chk_out_has_source CHECK (
    movement_type = 'in' OR (movement_type = 'out' AND (order_id IS NOT NULL OR movement_subtype IS NOT NULL))
  );

COMMIT;
