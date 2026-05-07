const stockModel = require('../models/stockMouvementModel');
const n8n = require('../services/n8nWebhookService');

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

module.exports = { list, create };
