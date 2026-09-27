-- Migration: Ajout des notions prix d'achat, prix de vente catalogue et prix réel de vente
-- Date: 2026-04-08

-- 1. Ajouter le prix d'achat sur les produits
ALTER TABLE app.products ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2) DEFAULT 0;

-- 2. Ajouter le prix d'achat sur les services
ALTER TABLE app.services ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2) DEFAULT 0;

-- 3. Sur les lignes de commande :
--    - catalog_price = prix de vente affiché au catalogue (snapshot au moment de la vente)
--    - purchase_price = prix d'achat (snapshot au moment de la vente)
--    - unit_price existant = prix réel de vente (négocié)
ALTER TABLE app.order_items ADD COLUMN IF NOT EXISTS catalog_price numeric(12,2) DEFAULT 0;
ALTER TABLE app.order_items ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2) DEFAULT 0;

-- 4. Sur la commande elle-même :
--    - catalog_amount = total au prix catalogue (sum catalog_price * qty)
--    - cost_amount    = total au prix d'achat   (sum purchase_price * qty)
--    - total_amount existant = total au prix réel (sum unit_price * qty)
ALTER TABLE app.orders ADD COLUMN IF NOT EXISTS catalog_amount numeric(12,2) DEFAULT 0;
ALTER TABLE app.orders ADD COLUMN IF NOT EXISTS cost_amount numeric(12,2) DEFAULT 0;

-- 5. Retroactively populate catalog_price from unit_price for existing order_items
--    (on suppose que les anciennes commandes n'avaient pas de remise par article)
UPDATE app.order_items SET catalog_price = unit_price WHERE catalog_price = 0;

-- 6. Recalculer catalog_amount et cost_amount pour les commandes existantes
UPDATE app.orders o
SET
  catalog_amount = sub.cat,
  cost_amount    = 0
FROM (
  SELECT order_id, SUM(catalog_price * quantity) AS cat
  FROM app.order_items
  GROUP BY order_id
) sub
WHERE o.id = sub.order_id;
