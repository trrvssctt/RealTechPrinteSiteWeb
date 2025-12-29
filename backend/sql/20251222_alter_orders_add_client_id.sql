-- Migration: add client_id to orders
ALTER TABLE IF EXISTS app.orders
ADD COLUMN IF NOT EXISTS client_id uuid;

-- Add FK constraint linking to app.clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'orders' AND tc.constraint_name = 'orders_client_id_fkey'
  ) THEN
    ALTER TABLE app.orders
    ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES app.clients(id);
  END IF;
END$$;
