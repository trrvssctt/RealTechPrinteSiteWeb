const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Public: create an order
exports.createOrder = async (req, res, next) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      items,
      total_amount,
      shipping_address,
      billing_address,
      metadata
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items required' });
    }

    const orderId = uuidv4();
    const orderNumber = `CMD-${Date.now().toString().slice(-6)}`;

    await db.query('BEGIN');
    const q = `INSERT INTO app.orders (id, user_id, status, total_amount, placed_at, shipping_address, billing_address, metadata)
               VALUES ($1,$2,$3,$4,now(),$5,$6,$7) RETURNING *`;
    const status = 'pending';
    const { rows } = await db.query(q, [orderId, null, status, total_amount || 0, shipping_address || null, billing_address || null, metadata || null]);

    // insert order_items
    for (const it of items) {
      await db.query(
        `INSERT INTO app.order_items (order_id, product_id, product_name, unit_price, quantity, total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [orderId, it.product_id || null, it.product_name || it.name || null, it.unit_price || it.price || 0, it.quantity || 1, (it.unit_price || it.price || 0) * (it.quantity || 1)]
      );
    }

    // store basic customer info in metadata for now
    await db.query(
      `UPDATE app.orders SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), $1, $2::jsonb, true) WHERE id = $3`,
      ['{customer}', JSON.stringify({ name: customer_name || null, phone: customer_phone || null, email: customer_email || null }), orderId]
    );

    await db.query('COMMIT');

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    await db.query('ROLLBACK');
    next(err);
  }
};

// Admin: list orders with aggregated items
exports.listOrders = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT o.*, COALESCE(jsonb_agg(to_jsonb(oi) - 'order_id' ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM app.orders o
      LEFT JOIN app.order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.placed_at DESC
    `);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

// Admin: update order (status, etc.)
exports.updateOrder = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const { rows } = await db.query('UPDATE app.orders SET status = COALESCE($1, status) WHERE id = $2 RETURNING *', [status || null, id]);
    res.json({ data: rows[0] || null });
  } catch (err) {
    next(err);
  }
};
