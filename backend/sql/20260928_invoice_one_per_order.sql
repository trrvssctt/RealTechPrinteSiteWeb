-- Migration: une seule facture (acompte / définitive) par commande
-- Date: 2026-09-28
--
-- Une facture liée à une commande n'est jamais figée : son type (acompte tant que
-- la commande n'est pas soldée, puis définitive), ses articles et ses montants sont
-- recalculés depuis la commande à chaque lecture. Elle garde son numéro unique.
DROP INDEX IF EXISTS app.uq_invoices_definitive_per_order;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_one_per_order
    ON app.invoices(order_id)
    WHERE invoice_type <> 'proforma' AND status <> 'cancelled';
