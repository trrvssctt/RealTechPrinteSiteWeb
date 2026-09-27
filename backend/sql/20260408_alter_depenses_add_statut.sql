-- Migration: ajout du suivi de validation sur app.depenses
-- Date: 2026-04-08
-- Objectif: traçabilité et anti-fraude (statut, validateur, commentaire)

ALTER TABLE app.depenses
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'valide', 'rejete', 'annule')),
  ADD COLUMN IF NOT EXISTS commentaire_admin text,
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS depenses_statut_idx ON app.depenses (statut);
CREATE INDEX IF NOT EXISTS depenses_created_by_idx ON app.depenses (created_by);
