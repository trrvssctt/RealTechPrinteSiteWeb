-- Migration: Ajouter la colonne deleted_at à app.products (corbeille / archivage)
-- Permet une vraie suppression qui retire le produit de la liste et du site,
-- tout en préservant l'historique (order_items, stock_mouvement référencent le produit).
-- À exécuter une seule fois sur la base de données.

BEGIN;

-- 1. Colonne de suppression logique
ALTER TABLE app.products
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- 2. Index pour exclure efficacement les produits supprimés des listes
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON app.products (deleted_at);

COMMIT;
