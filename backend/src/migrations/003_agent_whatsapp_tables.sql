-- ============================================================
-- Migration 003 : Agent IA + Notifications WhatsApp
-- ============================================================

-- Table pour les conversations de l'agent IA (admin panel)
CREATE TABLE IF NOT EXISTS app.agent_conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id    UUID REFERENCES app.users(id) ON DELETE SET NULL,
    messages    JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour le journal des notifications WhatsApp envoyées
CREATE TABLE IF NOT EXISTS app.whatsapp_notifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type    VARCHAR(60) NOT NULL,   -- 'sale_completed' | 'order_created' | 'stock_exit' | 'order_cancelled' | 'daily_report'
    event_id      UUID,                   -- order_id ou movement_id concerné
    message       TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
    sent_at       TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata      JSONB,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les requêtes courantes
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifs_event_type ON app.whatsapp_notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifs_status     ON app.whatsapp_notifications(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifs_created_at ON app.whatsapp_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_admin  ON app.agent_conversations(admin_id);

-- Trigger updated_at sur agent_conversations
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_agent_conversations_updated_at ON app.agent_conversations;
CREATE TRIGGER trg_agent_conversations_updated_at
    BEFORE UPDATE ON app.agent_conversations
    FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
