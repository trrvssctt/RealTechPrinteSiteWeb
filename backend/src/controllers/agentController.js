/**
 * Controller Agent IA — RealTech
 * Fournit :
 *   1. Les endpoints de données que le workflow n8n interroge (outils de l'agent)
 *   2. Le point d'entrée du chat admin (POST /chat) qui relaye la question à n8n
 *   3. L'historique des conversations
 *   4. Le journal des notifications WhatsApp
 */

const pool     = require('../config/db');
const { askAgent } = require('../services/n8nWebhookService');

// ─── Données pour les outils n8n ────────────────────────────────────────────

// Résumé global : CA, commandes, employés actifs
exports.getStats = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        -- Chiffre d'affaires
        (SELECT COALESCE(SUM(total_amount), 0) FROM app.orders WHERE status = 'completed')
          AS ca_total,
        (SELECT COALESCE(SUM(total_amount), 0) FROM app.orders WHERE status = 'completed' AND placed_at::date = CURRENT_DATE)
          AS ca_aujourd_hui,
        (SELECT COALESCE(SUM(total_amount), 0) FROM app.orders WHERE status = 'completed' AND placed_at >= date_trunc('month', NOW()))
          AS ca_ce_mois,

        -- Commandes
        (SELECT COUNT(*) FROM app.orders)                                          AS nb_commandes_total,
        (SELECT COUNT(*) FROM app.orders WHERE status = 'pending')                 AS nb_commandes_en_attente,
        (SELECT COUNT(*) FROM app.orders WHERE status = 'completed')               AS nb_commandes_completees,
        (SELECT COUNT(*) FROM app.orders WHERE placed_at::date = CURRENT_DATE)     AS nb_commandes_aujourd_hui,

        -- Clients
        (SELECT COUNT(*) FROM app.clients)                                         AS nb_clients_total,
        (SELECT COUNT(*) FROM app.clients WHERE created_at::date = CURRENT_DATE)   AS nb_nouveaux_clients_aujourd_hui,

        -- Employés actifs
        (SELECT COUNT(*) FROM app.users u
           JOIN app.user_roles ur ON ur.user_id = u.id
           JOIN app.roles r       ON r.id = ur.role_id
         WHERE u.is_active = TRUE AND u.status != 'supprimé'
           AND r.name IN ('employee','employe','employé','staff'))
          AS nb_employes_actifs,

        -- Stock total
        (SELECT COALESCE(SUM(stock), 0) FROM app.products WHERE is_active = TRUE) AS stock_total_unites,

        -- Dépenses du mois
        (SELECT COALESCE(SUM(montant), 0) FROM app.depenses WHERE created_at >= date_trunc('month', NOW()))
          AS depenses_ce_mois
    `);
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
};

// Employés actifs avec leurs stats
exports.getEmployees = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.is_active,
        u.status,
        array_agg(DISTINCT r.name) AS roles,
        (SELECT COUNT(*) FROM app.orders WHERE created_by = u.id) AS nb_commandes_creees,
        (SELECT COALESCE(SUM(total_amount),0) FROM app.orders WHERE created_by = u.id AND status='completed') AS ca_genere
      FROM app.users u
      JOIN app.user_roles ur ON ur.user_id = u.id
      JOIN app.roles r       ON r.id = ur.role_id
      WHERE u.status != 'supprimé'
        AND r.name IN ('employee','employe','employé','staff')
      GROUP BY u.id
      ORDER BY u.full_name
    `);
    res.json({ data: rows });
  } catch (err) { next(err); }
};

// Dernières ventes
exports.getSales = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const status = req.query.status || 'completed';
    const start  = req.query.start  || null;
    const end    = req.query.end    || null;

    const params = [limit];
    let dateFilter = '';
    if (start) { params.push(start); dateFilter += ` AND o.placed_at::date >= $${params.length}`; }
    if (end)   { params.push(end);   dateFilter += ` AND o.placed_at::date <= $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT
        o.id,
        o.placed_at,
        o.status,
        o.total_amount,
        c.full_name   AS client,
        u.full_name   AS employe,
        COALESCE(
          json_agg(json_build_object(
            'produit', COALESCE(oi.product_name, oi.service_name,'—'),
            'qte',     oi.quantity,
            'pu',      oi.unit_price,
            'total',   oi.total
          )) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS lignes
      FROM app.orders o
      LEFT JOIN app.clients    c  ON c.id = o.client_id
      LEFT JOIN app.users      u  ON u.id = o.created_by
      LEFT JOIN app.order_items oi ON oi.order_id = o.id
      WHERE ($2::text IS NULL OR o.status = $2) ${dateFilter}
      GROUP BY o.id, c.full_name, u.full_name
      ORDER BY o.placed_at DESC
      LIMIT $1
    `, [limit, status || null, ...params.slice(1)]);

    res.json({ data: rows });
  } catch (err) { next(err); }
};

// Niveaux de stock
exports.getStock = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.stock,
        p.threshold,
        p.price,
        cat.name AS categorie,
        CASE
          WHEN p.stock = 0          THEN 'rupture'
          WHEN p.stock <= p.threshold THEN 'critique'
          ELSE 'ok'
        END AS etat_stock
      FROM app.products p
      LEFT JOIN app.categories cat ON cat.id = p.category_id
      WHERE p.is_active = TRUE
      ORDER BY p.stock ASC
    `);
    res.json({ data: rows });
  } catch (err) { next(err); }
};

// Top produits
exports.getTopProducts = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const { rows } = await pool.query(`
      SELECT
        oi.product_name,
        SUM(oi.quantity)   AS qte_vendue,
        SUM(oi.total)      AS ca_genere,
        COUNT(DISTINCT o.id) AS nb_commandes
      FROM app.order_items oi
      JOIN app.orders o ON o.id = oi.order_id
      WHERE o.status = 'completed' AND oi.product_id IS NOT NULL
      GROUP BY oi.product_name
      ORDER BY qte_vendue DESC
      LIMIT $1
    `, [limit]);
    res.json({ data: rows });
  } catch (err) { next(err); }
};

// Derniers clients
exports.getClients = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.full_name,
        c.email,
        c.phone,
        c.is_active,
        c.created_at,
        COUNT(o.id)                  AS nb_commandes,
        COALESCE(SUM(o.total_amount),0) AS ca_total
      FROM app.clients c
      LEFT JOIN app.orders o ON o.client_id = c.id AND o.status = 'completed'
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $1
    `, [limit]);
    res.json({ data: rows });
  } catch (err) { next(err); }
};

// Résumé dépenses
exports.getDepenses = async (req, res, next) => {
  try {
    const start = req.query.start || null;
    const end   = req.query.end   || null;
    const params = [];
    let dateFilter = '';
    if (start) { params.push(start); dateFilter += ` AND d.created_at::date >= $${params.length}`; }
    if (end)   { params.push(end);   dateFilter += ` AND d.created_at::date <= $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT
        d.id,
        d.description,
        d.montant,
        d.categorie,
        d.statut,
        d.created_at,
        u.full_name AS employe
      FROM app.depenses d
      LEFT JOIN app.users u ON u.id = d.created_by
      WHERE 1=1 ${dateFilter}
      ORDER BY d.created_at DESC
      LIMIT 50
    `, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
};

// ─── Chat Admin ──────────────────────────────────────────────────────────────

exports.chat = async (req, res, next) => {
  try {
    const { question, conversation_id } = req.body;
    const adminId = req.user?.id;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'question requise' });
    }

    // Charger ou créer la conversation
    let convId = conversation_id;
    let existingMessages = [];

    if (!convId) {
      const { rows } = await pool.query(
        `INSERT INTO app.agent_conversations (admin_id, messages) VALUES ($1, '[]') RETURNING id`,
        [adminId]
      );
      convId = rows[0].id;
    } else {
      // Charger l'historique existant pour l'envoyer à l'agent
      const { rows } = await pool.query(
        `SELECT messages FROM app.agent_conversations WHERE id = $1`,
        [convId]
      );
      const raw = rows[0]?.messages;
      existingMessages = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
    }

    const userMessage = { role: 'user', content: question.trim(), ts: new Date().toISOString() };

    // Sauvegarder le message utilisateur
    await pool.query(
      `UPDATE app.agent_conversations
         SET messages = messages || $1::jsonb, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([userMessage]), convId]
    );

    // Appel n8n avec l'historique complet (existingMessages + nouveau message)
    const messagesForAgent = [...existingMessages, userMessage];
    const agentResp = await askAgent(question, adminId, convId, messagesForAgent);
    const resp0  = Array.isArray(agentResp) ? agentResp[0] : agentResp;
    const answer = resp0?.formattedResponse || resp0?.answer || resp0?.text || resp0?.output || resp0?.response || resp0?.message || resp0?.result || "Je n'ai pas pu obtenir de réponse.";

    // Sauvegarder la réponse du bot
    await pool.query(
      `UPDATE app.agent_conversations
         SET messages = messages || $1::jsonb, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([{ role: 'assistant', content: answer, ts: new Date().toISOString() }]), convId]
    );

    res.json({ answer, conversation_id: convId });
  } catch (err) { next(err); }
};

// Historique des conversations
exports.listConversations = async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const limit   = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const { rows } = await pool.query(
      `SELECT id, messages, created_at, updated_at FROM app.agent_conversations
       WHERE admin_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [adminId, limit]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
};

// Récupérer une conversation
exports.getConversation = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM app.agent_conversations WHERE id = $1 AND admin_id = $2`,
      [req.params.id, req.user?.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Conversation non trouvée' });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
};

// ─── Journal notifications WhatsApp ─────────────────────────────────────────

exports.listNotifications = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);
    const status = req.query.status || null;
    const type   = req.query.type   || null;

    const params = [limit, offset];
    const where  = [];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (type)   { params.push(type);   where.push(`event_type = $${params.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT * FROM app.whatsapp_notifications ${whereClause}
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    const { rows: total } = await pool.query(
      `SELECT COUNT(*) FROM app.whatsapp_notifications ${whereClause}`,
      params.slice(2)
    );
    res.json({ data: rows, total: parseInt(total[0].count) });
  } catch (err) { next(err); }
};

// Renvoyer une notification échouée
exports.retryNotification = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM app.whatsapp_notifications WHERE id = $1 AND status = 'failed'`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Notification non trouvée ou déjà envoyée' });
    const n = rows[0];

    const n8n = require('../services/n8nWebhookService');
    const payload = n.metadata || {};
    payload.event_type = n.event_type;
    payload.message    = n.message;
    payload.event_id   = n.event_id;

    // Réinitialiser avant retry
    await pool.query(
      `UPDATE app.whatsapp_notifications SET status='pending', error_message=NULL WHERE id=$1`,
      [n.id]
    );

    // sendEvent interne
    const { default: fetch } = await import('node-fetch');
    const url = `${process.env.N8N_BASE_URL || ''}${process.env.N8N_EVENTS_PATH || '/webhook/realtech/events'}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 8000,
    });

    if (resp.ok) {
      await pool.query(
        `UPDATE app.whatsapp_notifications SET status='sent', sent_at=NOW(), error_message=NULL WHERE id=$1`,
        [n.id]
      );
      res.json({ ok: true, message: 'Renvoyé avec succès' });
    } else {
      const text = await resp.text().catch(() => '');
      await pool.query(
        `UPDATE app.whatsapp_notifications SET status='failed', error_message=$1 WHERE id=$2`,
        [`HTTP ${resp.status}: ${text}`, n.id]
      );
      res.status(502).json({ error: `Échec renvoi : HTTP ${resp.status}` });
    }
  } catch (err) { next(err); }
};
