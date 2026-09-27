-- Migration: paiements en plusieurs fois + état de la commande figé sur la facture
-- Date: 2026-09-27
--
-- app.payments (déjà présente, vide) reçoit un versement par encaissement
-- saisi dans « Finaliser la commande » (et un versement unique pour une vente directe).
ALTER TABLE app.payments ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES app.users(id) ON DELETE SET NULL;
ALTER TABLE app.payments ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE app.payments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_payments_order ON app.payments(order_id);

-- État de la commande au moment de l'émission de la facture :
-- { order_status, delivery_status, payment_status, amount_paid, remaining, payments: [{ paid_at, method, amount }] }
ALTER TABLE app.invoices ADD COLUMN IF NOT EXISTS order_state jsonb;
