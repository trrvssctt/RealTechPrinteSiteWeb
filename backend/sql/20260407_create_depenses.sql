-- Migration: création de la table app.depenses
-- Date: 2026-04-07
-- Description: Table pour enregistrer les dépenses journalières de la boutique

CREATE TABLE IF NOT EXISTS app.depenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    description text NOT NULL,
    montant numeric(12,2) NOT NULL CHECK (montant >= 0),
    categorie text,
    created_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT depenses_pkey PRIMARY KEY (id)
);

ALTER TABLE app.depenses OWNER TO gestionapp;

-- Index pour les requêtes journalières
CREATE INDEX IF NOT EXISTS depenses_created_at_idx ON app.depenses (created_at);
