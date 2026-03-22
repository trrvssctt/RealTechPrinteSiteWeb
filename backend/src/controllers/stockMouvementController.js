const stockModel = require('../models/stockMouvementModel');

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
    res.status(201).json({ data: result.movement, product: result.product });
  } catch (err) {
    if (err.message === 'insufficient_stock') return res.status(400).json({ error: 'insufficient_stock' });
    if (err.message === 'invalid_payload') return res.status(400).json({ error: 'invalid_payload' });
    next(err);
  }
};

module.exports = { list, create };
