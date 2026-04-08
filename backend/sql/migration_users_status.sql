-- Migration: Ajouter colonnes status, deleted_at, deleted_by à app.users
-- À exécuter une seule fois sur la base de données

BEGIN;

-- 1. Ajouter les colonnes si elles n'existent pas
ALTER TABLE app.users
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'actif'
    CHECK (status IN ('actif', 'inactif', 'supprimé')),
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES app.users(id) ON DELETE SET NULL;

-- 2. Synchroniser le statut avec l'état actuel de is_active
UPDATE app.users SET status = 'inactif' WHERE is_active = false AND status = 'actif';

-- 3. Index pour les requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_users_status ON app.users (status);

COMMIT;
