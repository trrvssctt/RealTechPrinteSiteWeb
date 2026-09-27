-- Migration: Factures séquentielles (définitive, acompte, proforma)
-- Date: 2026-09-26
--
-- Toutes les factures partagent une seule numérotation, remise à zéro chaque
-- année : FAC-2026-00001, FAC-2026-00002, ...
-- Le numéro est attribué dans la même instruction que l'INSERT (voir
-- invoicesController), donc sans trou ni doublon même en cas d'accès concurrent.

CREATE TABLE IF NOT EXISTS app.invoice_counters (
    year        integer PRIMARY KEY,
    last_value  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app.invoices (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_year        integer NOT NULL,
    invoice_seq         integer NOT NULL,
    invoice_number      text NOT NULL UNIQUE,
    invoice_type        text NOT NULL CHECK (invoice_type IN ('definitive', 'acompte', 'proforma')),
    -- issued : émise | converted : proforma transformée en commande | cancelled : annulée
    status              text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'converted', 'cancelled')),
    order_id            uuid REFERENCES app.orders(id) ON DELETE SET NULL,
    converted_order_id  uuid REFERENCES app.orders(id) ON DELETE SET NULL,
    client_id           uuid REFERENCES app.clients(id) ON DELETE SET NULL,
    -- Instantané au moment de l'émission : une réimpression donne toujours le même document
    client              jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { name, phone, email }
    items               jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ product_id, service_id, name, sku, quantity, unit_price, total }]
    subtotal            numeric(12,2) NOT NULL DEFAULT 0,
    discount            numeric(12,2) NOT NULL DEFAULT 0,
    total_amount        numeric(12,2) NOT NULL DEFAULT 0,
    acompte_amount      numeric(12,2),                        -- facture d'acompte uniquement
    payment_method      text,
    notes               text,
    created_by          uuid REFERENCES app.users(id) ON DELETE SET NULL,
    issued_at           timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (invoice_year, invoice_seq)
);

CREATE INDEX IF NOT EXISTS idx_invoices_order     ON app.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client    ON app.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type      ON app.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON app.invoices(issued_at DESC);

-- Une seule facture définitive active par commande (les réimpressions la réutilisent)
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_definitive_per_order
    ON app.invoices(order_id)
    WHERE invoice_type = 'definitive' AND status <> 'cancelled';
