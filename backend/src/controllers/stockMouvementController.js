const stockModel = require('../models/stockMouvementModel');
const n8n = require('../services/n8nWebhookService');

// Anti-fraude : les sorties de stock ne se font que par les commandes (finalisation /
// livraison) ou leur annulation — jamais à la main depuis « Mouvements de stock ».
const MANUAL_EXIT_ERROR = {
  error: 'manual_exit_forbidden',
  message: 'Les sorties de stock manuelles sont interdites. Elles se font uniquement via les commandes.',
};

const list = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 2000);
    const offset = parseInt(req.query.offset || '0', 10);
    const product_id = req.query.product_id || null;
    const movement_type = req.query.movement_type || null;
    const start = req.query.start || null;

    const rows = await stockModel.listMovements({ limit, offset, product_id, movement_type, start });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id ? req.user.id : null;
    const payload = req.body || {};
    if (payload.movement_type !== 'in') return res.status(403).json(MANUAL_EXIT_ERROR);
    const result = await stockModel.createMovement(payload, userId);

    // Notifications WhatsApp pour les mouvements de stock (fire-and-forget)
    if (result.movement) {
      const enriched = {
        ...result.movement,
        product_name: result.product?.name || payload.product_name || null,
        employe: req.user?.full_name || req.user?.email || null,
      };
      if (result.movement.movement_type === 'out') {
        setImmediate(() => n8n.notifyStockExit(enriched).catch(e => console.warn('[n8n] Notification sortie stock échouée :', e.message)));
      } else if (result.movement.movement_type === 'in') {
        setImmediate(() => n8n.notifyStockEntry(enriched).catch(e => console.warn('[n8n] Notification entrée stock échouée :', e.message)));
      }
    }

    res.status(201).json({ data: result.movement, product: result.product });
  } catch (err) {
    if (err.message === 'insufficient_stock') return res.status(400).json({ error: 'insufficient_stock' });
    if (err.message === 'invalid_payload') return res.status(400).json({ error: 'invalid_payload' });
    next(err);
  }
};

// POST /api/admin/stock-mouvements/batch
// { movement_type: 'in'|'out', movement_subtype, reference?, note?, items: [{ product_id, quantity }] }
const createBatch = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id ? req.user.id : null;
    if ((req.body || {}).movement_type !== 'in') return res.status(403).json(MANUAL_EXIT_ERROR);
    const { batchId, results } = await stockModel.createMovementsBatch(req.body || {}, userId);

    // Une seule notification WhatsApp pour l'ensemble de l'opération
    const first = results[0].movement;
    const summary = {
      ...first,
      id: first.id,
      product_name: results.map(r => `${r.product?.name || r.movement.product_id} ×${r.movement.quantity}`).join(', '),
      quantity: results.reduce((s, r) => s + Number(r.movement.quantity || 0), 0),
      employe: req.user?.full_name || req.user?.email || null,
    };
    const notify = first.movement_type === 'out' ? n8n.notifyStockExit : n8n.notifyStockEntry;
    setImmediate(() => notify(summary).catch(e => console.warn('[n8n] Notification mouvement groupé échouée :', e.message)));

    res.status(201).json({ data: results.map(r => r.movement), products: results.map(r => r.product), batch_id: batchId });
  } catch (err) {
    if (err.message === 'insufficient_stock') {
      let name = null;
      try {
        const { rows } = await require('../config/db').query('SELECT name, stock FROM app.products WHERE id = $1', [err.product_id]);
        name = rows[0] ? `${rows[0].name} (disponible : ${rows[0].stock})` : null;
      } catch (_) {}
      return res.status(400).json({ error: 'insufficient_stock', product_id: err.product_id, product: name });
    }
    if (err.message === 'invalid_payload' || err.message === 'invalid_movement_type') return res.status(400).json({ error: 'invalid_payload' });
    next(err);
  }
};

module.exports = { list, create, createBatch };
