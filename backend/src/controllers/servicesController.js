const serviceModel = require('../models/serviceModel');
const n8n = require('../services/n8nWebhookService');
const db = require('../config/db');

async function list(req, res) {
  try {
    const q = req.query.q || null;
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    // by default show only active services; allow including inactive via query param
    const includeInactive = req.query.include_inactive === '1' || req.query.include_inactive === 'true' || req.query.show_inactive === '1' || req.query.show_inactive === 'true';
    const rows = await serviceModel.listServices({ limit, offset, q, includeInactive });
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to list services' });
  }
}

async function getOne(req, res) {
  try {
    const id = req.params.id;
    const row = await serviceModel.getServiceById(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Service not found' });
    res.json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to fetch service' });
  }
}

async function create(req, res) {
  try {
    const userId = req.user?.id || null;
    const data = req.body || {};
    console.log('Creating service:', { data, userId });
    if (!data.name) return res.status(400).json({ ok: false, error: 'Name is required' });
    const row = await serviceModel.createService(data, userId);
    res.status(201).json({ ok: true, data: row });
    setImmediate(() => n8n.notifyServiceCreated(row, req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (e) {
    console.error('Error creating service:', e);
    res.status(500).json({ ok: false, error: 'Failed to create service' });
  }
}

async function update(req, res) {
  try {
    const id = req.params.id;
    const data = req.body || {};
    console.log('Updating service:', { id, data });
    const row = await serviceModel.updateService(id, data);
    res.json({ ok: true, data: row });
    setImmediate(() => n8n.notifyServiceUpdated(row, req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (e) {
    console.error('Error updating service:', e);
    res.status(500).json({ ok: false, error: 'Failed to update service' });
  }
}

async function remove(req, res) {
  try {
    const id = req.params.id;
    const row = await serviceModel.updateService(id, { is_active: false });
    if (!row) return res.status(404).json({ ok: false, error: 'Service not found' });
    res.json({ ok: true, data: row });
    setImmediate(() => n8n.notifyServiceDeleted(row, req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to delete service' });
  }
}

// GET /api/admin/services/:id/stats — statistiques réelles, calculées à partir des
// lignes de commande contenant ce service (les commandes annulées sont exclues des totaux)
async function stats(req, res, next) {
  try {
    const { id } = req.params;
    const { rows: lines } = await db.query(
      `SELECT oi.id, oi.order_id, oi.quantity, oi.unit_price, oi.total,
              COALESCE(NULLIF(oi.purchase_price, 0), 0) AS purchase_price,
              o.status, o.placed_at, o.client_id,
              COALESCE(c.full_name, o.metadata->'customer'->>'name') AS client_name
         FROM app.order_items oi
         JOIN app.orders o ON o.id = oi.order_id
         LEFT JOIN app.clients c ON c.id = o.client_id
        WHERE oi.service_id = $1
        ORDER BY o.placed_at DESC`,
      [id]
    );

    const active = lines.filter(l => l.status !== 'cancelled');
    const num = (v) => Number(v) || 0;
    const orderIds = new Set(active.map(l => l.order_id));
    const completedIds = new Set(active.filter(l => l.status === 'completed').map(l => l.order_id));
    const totalQty = active.reduce((s, l) => s + num(l.quantity), 0);
    const revenue = active.reduce((s, l) => s + num(l.total), 0);
    const revenueCompleted = active.filter(l => l.status === 'completed').reduce((s, l) => s + num(l.total), 0);
    // Marge : seulement sur les lignes dont le prix d'achat est connu
    const withCost = active.filter(l => num(l.purchase_price) > 0);
    const margin = withCost.reduce((s, l) => s + (num(l.unit_price) - num(l.purchase_price)) * num(l.quantity), 0);
    const clientKeys = new Set(active.map(l => l.client_id || l.client_name).filter(Boolean));

    // 12 derniers mois
    const monthly = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, qty: 0, revenue: 0, orders: 0 });
    }
    const byMonth = Object.fromEntries(monthly.map(m => [m.month, m]));
    const seen = new Set();
    for (const l of active) {
      const d = new Date(l.placed_at);
      const m = byMonth[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`];
      if (!m) continue;
      m.qty += num(l.quantity);
      m.revenue += num(l.total);
      if (!seen.has(l.order_id)) { seen.add(l.order_id); m.orders += 1; }
    }

    // Meilleurs clients
    const clients = {};
    for (const l of active) {
      const key = l.client_id || l.client_name || 'inconnu';
      clients[key] = clients[key] || { client_id: l.client_id, name: l.client_name || 'Client inconnu', qty: 0, revenue: 0 };
      clients[key].qty += num(l.quantity);
      clients[key].revenue += num(l.total);
    }

    res.json({
      data: {
        totalOrders: orderIds.size,
        totalQty,
        revenue,
        revenueCompleted,
        avgUnitPrice: totalQty > 0 ? Math.round(revenue / totalQty) : 0,
        margin: withCost.length ? margin : null,
        distinctClients: clientKeys.size,
        completionRate: orderIds.size > 0 ? Math.round((completedIds.size / orderIds.size) * 100) : 0,
        cancelledOrders: new Set(lines.filter(l => l.status === 'cancelled').map(l => l.order_id)).size,
        firstSaleAt: active.length ? active[active.length - 1].placed_at : null,
        lastSaleAt: active.length ? active[0].placed_at : null,
        monthly,
        topClients: Object.values(clients).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
        lines: lines.slice(0, 200).map(l => ({
          order_id: l.order_id, placed_at: l.placed_at, status: l.status, client_id: l.client_id,
          client_name: l.client_name, quantity: num(l.quantity), unit_price: num(l.unit_price), total: num(l.total),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  stats,
  list,
  getOne,
  create,
  update,
  remove,
};
