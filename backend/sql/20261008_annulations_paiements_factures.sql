-- Migration : commandes déjà annulées dont l'argent restait compté
-- Date: 2026-10-08
-- Depuis ce correctif, annuler une commande passe ses versements à « refunded »
-- et ses factures émises à « cancelled ». Ce script applique la même règle aux
-- commandes annulées avant le correctif. Idempotent.

BEGIN;

UPDATE app.payments p
   SET status = 'refunded',
       note = CONCAT_WS(' — ', NULLIF(p.note, ''), 'Commande annulée le ' || to_char(COALESCE(o.cancelled_at, now()) AT TIME ZONE 'Africa/Dakar', 'DD/MM/YYYY'))
  FROM app.orders o
 WHERE o.id = p.order_id
   AND o.status = 'cancelled'
   AND p.status = 'paid';

UPDATE app.invoices i
   SET status = 'cancelled'
  FROM app.orders o
 WHERE o.id = i.order_id
   AND o.status = 'cancelled'
   AND i.status = 'issued'
   AND i.invoice_type <> 'proforma';

COMMIT;
