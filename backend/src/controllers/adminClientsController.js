const clientModel = require('../models/clientModel');
const db = require('../config/db');
const n8n = require('../services/n8nWebhookService');

const listClients = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '500', 10), 2000);
    const offset = parseInt(req.query.offset || '0', 10);
    const search = req.query.q || null;

    // Enrichir la liste avec les stats financières de chaque client
    const { rows } = await db.query(`
      SELECT
        c.id, c.full_name, c.email, c.phone,
        c.is_active, c.created_at, c.created_by_channel,
        COUNT(DISTINCT o.id)::int                          AS total_orders,
        COALESCE(SUM(o.total_amount), 0)                   AS total_spent,
        COALESCE(AVG(o.total_amount), 0)                   AS avg_order,
        MAX(o.placed_at)                                   AS last_order_at,
        COALESCE(SUM(CASE WHEN o.status='completed'
          THEN o.total_amount ELSE 0 END), 0)              AS total_completed,
        COUNT(CASE WHEN o.status='pending' THEN 1 END)::int AS pending_orders
      FROM app.clients c
      LEFT JOIN app.orders o ON o.client_id = c.id
      WHERE c.is_active = true
        ${search ? `AND (c.full_name ILIKE $3 OR c.email ILIKE $3 OR c.phone ILIKE $3)` : ''}
      GROUP BY c.id
      ORDER BY total_spent DESC, c.created_at DESC
      LIMIT $1 OFFSET $2
    `, search ? [limit, offset, `%${search}%`] : [limit, offset]);

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const getClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await clientModel.getClientById(id);
    if (!client) return res.status(404).json({ error: 'client not found' });
    // enrich client with creator/updater info if available
    try {
      if (client.created_by_user) {
        const { rows } = await db.query(`SELECT id, full_name AS name, email FROM app.users WHERE id = $1 LIMIT 1`, [client.created_by_user]);
        client.created_by_user_info = rows[0] || null;
      }
      if (client.updated_by_user) {
        const { rows } = await db.query(`SELECT id, full_name AS name, email FROM app.users WHERE id = $1 LIMIT 1`, [client.updated_by_user]);
        client.updated_by_user_info = rows[0] || null;
      }
    } catch (err) {
      // non blocking: if lookup fails, continue without info
      console.error('could not fetch creator/updater info', err);
    }

    res.json({ data: client });
  } catch (err) {
    next(err);
  }
};

const createClient = async (req, res, next) => {
  try {
    const { full_name, email, phone, created_by_channel, metadata } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    // strict duplicate prevention: if client exists by email or phone, reject
    const existingByEmail = await clientModel.getClientByEmail(email);
    if (existingByEmail) return res.status(409).json({ error: 'email already exists' });
    if (phone) {
      const existingByPhone = await clientModel.getClientByPhone(phone);
      if (existingByPhone) return res.status(409).json({ error: 'phone already exists' });
    }
    const created_by_user = req.user?.id || null;
    const client = await clientModel.createClient({ full_name, email, phone, created_by_channel, metadata, created_by_user });
    res.status(201).json({ client });
    setImmediate(() => n8n.notifyClientCreated(client, req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (err) {
    next(err);
  }
};

const updateClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    // attach updater id when available
    payload.updated_by_user = req.user?.id || null;
    const client = await clientModel.updateClient(id, payload);
    res.json({ client });
    setImmediate(() => n8n.notifyClientUpdated(client, req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (err) {
    next(err);
  }
};

const deleteClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    // prevent deletion if there are pending orders for this client
    const { rows } = await db.query(`SELECT COUNT(*)::int AS pending FROM app.orders WHERE client_id = $1 AND status = $2`, [id, 'pending']);
    const pending = rows[0] ? rows[0].pending : 0;
    if (pending > 0) return res.status(400).json({ error: 'client has pending orders' });

    const client = await clientModel.softDeleteClient(id);
    res.json({ client });
    setImmediate(() => n8n.notifyClientDeleted(client, req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (err) {
    next(err);
  }
};

const stats = async (req, res, next) => {
  try {
    const s = await clientModel.clientStats();
    res.json({ data: s });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/clients/ranking — top 10 clients par chiffre d'affaires
const getRanking = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        c.id, c.full_name, c.email, c.phone,
        COUNT(DISTINCT o.id)::int        AS total_orders,
        COALESCE(SUM(o.total_amount),0)  AS total_spent,
        COALESCE(AVG(o.total_amount),0)  AS avg_order,
        MAX(o.placed_at)                 AS last_order_at,
        RANK() OVER (ORDER BY COALESCE(SUM(o.total_amount),0) DESC)::int AS rank
      FROM app.clients c
      LEFT JOIN app.orders o ON o.client_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY total_spent DESC
      LIMIT 20
    `);
    res.json({ data: rows });
  } catch (err) { next(err); }
};

// GET /api/admin/clients/:id/stats — analytics complet d'un client
const getClientStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [
      clientRows,
      ordersRows,
      topProductsRows,
      monthlyRows,
      rankRow,
    ] = await Promise.all([

      // Profil client
      db.query(`SELECT * FROM app.clients WHERE id = $1 LIMIT 1`, [id]),

      // Toutes les commandes avec leurs lignes
      db.query(`
        SELECT
          o.id, o.status, o.total_amount, o.placed_at, o.completed_at,
          o.cancel_reason, o.cancelled_at,
          u.full_name AS traite_par,
          json_agg(
            json_build_object(
              'name',       COALESCE(oi.product_name, oi.service_name, '—'),
              'qty',        oi.quantity,
              'unit_price', oi.unit_price,
              'total',      oi.total
            ) ORDER BY oi.total DESC
          ) FILTER (WHERE oi.id IS NOT NULL) AS items
        FROM app.orders o
        LEFT JOIN app.order_items oi ON oi.order_id = o.id
        LEFT JOIN app.users u ON u.id = o.created_by
        WHERE o.client_id = $1
        GROUP BY o.id, u.full_name
        ORDER BY o.placed_at DESC
      `, [id]),

      // Top produits commandés par ce client
      db.query(`
        SELECT
          COALESCE(oi.product_name, oi.service_name, '—')  AS name,
          SUM(oi.quantity)::int                              AS total_qty,
          SUM(oi.total)                                      AS total_amount,
          COUNT(DISTINCT o.id)::int                          AS nb_orders
        FROM app.order_items oi
        JOIN app.orders o ON o.id = oi.order_id
        WHERE o.client_id = $1
          AND o.status != 'cancelled'
        GROUP BY COALESCE(oi.product_name, oi.service_name, '—')
        ORDER BY total_amount DESC
        LIMIT 5
      `, [id]),

      // Évolution mensuelle du CA (12 derniers mois)
      db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', o.placed_at), 'YYYY-MM') AS month,
          COUNT(*)::int                                          AS nb_orders,
          COALESCE(SUM(o.total_amount), 0)                      AS revenue
        FROM app.orders o
        WHERE o.client_id = $1
          AND o.placed_at >= NOW() - INTERVAL '12 months'
          AND o.status != 'cancelled'
        GROUP BY DATE_TRUNC('month', o.placed_at)
        ORDER BY month ASC
      `, [id]),

      // Rang du client parmi tous les clients (par CA total)
      db.query(`
        SELECT rank, total_spent FROM (
          SELECT
            c2.id,
            COALESCE(SUM(o2.total_amount), 0) AS total_spent,
            RANK() OVER (ORDER BY COALESCE(SUM(o2.total_amount),0) DESC)::int AS rank
          FROM app.clients c2
          LEFT JOIN app.orders o2 ON o2.client_id = c2.id
          WHERE c2.is_active = true
          GROUP BY c2.id
        ) ranked
        WHERE id = $1
      `, [id]),
    ]);

    if (!clientRows.rows[0]) return res.status(404).json({ error: 'not_found' });

    const orders = ordersRows.rows;
    const totalSpent    = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
    const completedOrds = orders.filter(o => o.status === 'completed');
    const cancelledOrds = orders.filter(o => o.status === 'cancelled');
    const pendingOrds   = orders.filter(o => o.status === 'pending');
    const avgOrder      = orders.length > 0 ? totalSpent / orders.length : 0;

    // CA ce mois vs mois dernier
    const now      = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const lastDate  = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const lastMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth()+1).padStart(2,'0')}`;

    const thisMonthRevenue = monthlyRows.rows.find(r => r.month === thisMonth)?.revenue || 0;
    const lastMonthRevenue = monthlyRows.rows.find(r => r.month === lastMonth)?.revenue || 0;
    const growth = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : thisMonthRevenue > 0 ? 100 : 0;

    res.json({
      client:      clientRows.rows[0],
      rank:        rankRow.rows[0]?.rank || null,
      summary: {
        totalOrders:     orders.length,
        totalSpent,
        avgOrder,
        completedCount:  completedOrds.length,
        cancelledCount:  cancelledOrds.length,
        pendingCount:    pendingOrds.length,
        thisMonthRevenue: parseFloat(thisMonthRevenue),
        lastMonthRevenue: parseFloat(lastMonthRevenue),
        growth,
      },
      orders,
      topProducts:  topProductsRows.rows,
      monthly:      monthlyRows.rows,
    });
  } catch (err) { next(err); }
};

module.exports = { listClients, getClient, createClient, updateClient, deleteClient, stats, getRanking, getClientStats };
