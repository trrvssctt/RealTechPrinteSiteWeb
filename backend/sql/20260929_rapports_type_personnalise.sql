-- Migration: autoriser le type de rapport « personnalise » (proposé dans l'écran Rapports)
-- Date: 2026-09-29
ALTER TABLE app.rapports DROP CONSTRAINT IF EXISTS rapports_type_rapport_check;
ALTER TABLE app.rapports ADD CONSTRAINT rapports_type_rapport_check
    CHECK (type_rapport = ANY (ARRAY['journalier'::text, 'mensuelle'::text, 'annuelle'::text, 'personnalise'::text]));
