-- Add service support to order_items
ALTER TABLE IF EXISTS app.order_items
  ADD COLUMN IF NOT EXISTS service_id uuid,
  ADD COLUMN IF NOT EXISTS service_name text;

CREATE INDEX IF NOT EXISTS idx_order_items_service_id ON app.order_items (service_id);
