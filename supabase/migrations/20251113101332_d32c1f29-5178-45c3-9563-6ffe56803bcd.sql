-- Table pour tracker les visites/sessions
CREATE TABLE public.analytics_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  page_path text NOT NULL,
  referrer text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_visits_session_id ON public.analytics_visits(session_id);
CREATE INDEX idx_analytics_visits_user_id ON public.analytics_visits(user_id);
CREATE INDEX idx_analytics_visits_created_at ON public.analytics_visits(created_at);

-- Table pour les paniers
CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  channel text DEFAULT 'site',
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_carts_session_id ON public.carts(session_id);
CREATE INDEX idx_carts_user_id ON public.carts(user_id);
CREATE INDEX idx_carts_status ON public.carts(status);
CREATE INDEX idx_carts_last_activity ON public.carts(last_activity_at);

-- Trigger pour mettre à jour updated_at sur carts
CREATE TRIGGER update_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies pour analytics_visits
ALTER TABLE public.analytics_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert visits"
  ON public.analytics_visits
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all visits"
  ON public.analytics_visits
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies pour carts
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own carts"
  ON public.carts
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Anyone can create carts"
  ON public.carts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own carts"
  ON public.carts
  FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    session_id IN (SELECT session_id FROM public.carts WHERE id = public.carts.id)
  );

CREATE POLICY "Admins can update all carts"
  ON public.carts
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete carts"
  ON public.carts
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Commentaires pour documentation
COMMENT ON TABLE public.analytics_visits IS 'Table pour tracker les visites et sessions utilisateurs';
COMMENT ON TABLE public.carts IS 'Table pour gérer les paniers actifs et abandonnés. Un panier est considéré abandonné après 2 heures d''inactivité (détecté via last_activity_at).';
COMMENT ON COLUMN public.carts.items IS 'Array JSON des produits: [{"product_id": "uuid", "name": "string", "quantity": number, "price": number}]';
COMMENT ON COLUMN public.carts.channel IS 'Canal d''origine: site, whatsapp, phone';