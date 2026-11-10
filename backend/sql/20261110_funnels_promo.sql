-- Funnels promo : page de vente dédiée à un produit, avec formules (variantes),
-- réservation du stock promo et paiement Wave / Orange Money / à la livraison.
-- À exécuter une fois sur la base partagée.

BEGIN;

CREATE TABLE IF NOT EXISTS app.funnels (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE,
  title                text NOT NULL,
  product_id           uuid NOT NULL REFERENCES app.products(id),
  description          text,
  bullets              jsonb NOT NULL DEFAULT '[]'::jsonb,   -- arguments affichés sous le prix
  image_url            text,                                 -- sinon images du produit
  starts_at            timestamptz,
  ends_at              timestamptz,                          -- fin du compte à rebours
  is_published         boolean NOT NULL DEFAULT false,       -- false = brouillon
  max_qty              integer NOT NULL DEFAULT 3 CHECK (max_qty BETWEEN 1 AND 100),
  payment_methods      jsonb NOT NULL DEFAULT '{"wave": true, "orange_money": true, "cod": true}'::jsonb,
  confirmation_message text,
  visits               integer NOT NULL DEFAULT 0,
  created_by           uuid REFERENCES app.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.funnel_variants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id  uuid NOT NULL REFERENCES app.funnels(id) ON DELETE CASCADE,
  label      text NOT NULL,
  price      numeric(12,2) NOT NULL CHECK (price >= 0),
  stock      integer NOT NULL DEFAULT 0 CHECK (stock >= 0),     -- stock promo de la formule
  position   integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_funnel_variants_funnel ON app.funnel_variants (funnel_id);

-- Référence lisible donnée au client (motif du transfert) : RT-4801, RT-4802…
CREATE SEQUENCE IF NOT EXISTS app.funnel_order_ref_seq START 4801;

CREATE TABLE IF NOT EXISTS app.funnel_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref            text NOT NULL UNIQUE DEFAULT ('RT-' || nextval('app.funnel_order_ref_seq')),
  funnel_id      uuid NOT NULL REFERENCES app.funnels(id),
  variant_id     uuid REFERENCES app.funnel_variants(id) ON DELETE SET NULL,
  variant_label  text NOT NULL,
  product_id     uuid NOT NULL REFERENCES app.products(id),
  quantity       integer NOT NULL CHECK (quantity > 0),
  unit_price     numeric(12,2) NOT NULL,
  total_amount   numeric(12,2) NOT NULL,
  customer_name  text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  reception      text NOT NULL DEFAULT 'delivery' CHECK (reception IN ('delivery', 'pickup')),
  address        text,
  payment_method text CHECK (payment_method IN ('wave', 'orange_money', 'cod')),
  -- reserved : stock bloqué, paiement pas encore déclaré (expire)
  -- declared : le client dit avoir payé (Wave / OM) → à confirmer
  -- cod_pending : paiement à la livraison → à livrer et encaisser
  -- not_received : l'admin n'a pas trouvé le paiement (relance envoyée)
  -- paid : confirmé, commande et facture créées ; cancelled / expired : stock libéré
  status         text NOT NULL DEFAULT 'reserved'
                 CHECK (status IN ('reserved', 'declared', 'cod_pending', 'not_received', 'confirming', 'paid', 'cancelled', 'expired')),
  expires_at     timestamptz,
  declared_at    timestamptz,
  confirmed_at   timestamptz,
  confirmed_by   uuid REFERENCES app.users(id) ON DELETE SET NULL,
  cancelled_at   timestamptz,
  cancel_reason  text,
  access_token   text NOT NULL UNIQUE,                     -- lien privé du client (page de suivi + facture)
  proforma_id    uuid REFERENCES app.invoices(id) ON DELETE SET NULL,
  order_id       uuid REFERENCES app.orders(id) ON DELETE SET NULL,
  invoice_id     uuid REFERENCES app.invoices(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funnel_orders_funnel ON app.funnel_orders (funnel_id, status);
CREATE INDEX IF NOT EXISTS idx_funnel_orders_variant ON app.funnel_orders (variant_id, status);

-- Réglages de paiement par défaut (modifiables dans Funnels promo › Réglages paiement)
INSERT INTO app.settings (key, value, description)
VALUES ('funnel_payment', '{
  "wave":         {"enabled": true,  "number": "", "holder": "RealTech Holding"},
  "orange_money": {"enabled": true,  "number": "", "holder": "RealTech Holding"},
  "cod":          {"enabled": true,  "zones": "Dakar", "max_amount": 300000},
  "reservation_minutes": 30,
  "team_email": "",
  "team_whatsapp": ""
}'::jsonb, 'Funnels promo : moyens de paiement et alertes')
ON CONFLICT (key) DO NOTHING;

COMMIT;
