const db = require('../config/db');
const { v4: uuidv4, validate: validateUuid } = require('uuid');

function safeProductId(id) {
  if (!id) return null;
  try {
    return validateUuid(id) ? id : null;
  } catch (e) {
    return null;
  }
}

const getCartBySession = async (req, res, next) => {
  try {
    const session_id = req.query.session_id;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const { rows } = await db.query('SELECT * FROM app.carts WHERE session_id = $1 AND status = $2 LIMIT 1', [session_id, 'active']);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const createCart = async (req, res, next) => {
  try {
    const { session_id, user_id, items, total_amount } = req.body;
    const id = uuidv4();
    // If there is already an active cart for this session, update it instead
    if (session_id) {
      const { rows: existing } = await db.query('SELECT * FROM app.carts WHERE session_id = $1 AND status = $2 LIMIT 1', [session_id, 'active']);
      if (existing && existing[0]) {
        const existingId = existing[0].id;
        const itemsJson = Array.isArray(items) ? JSON.stringify(items) : existing[0].items;
        await db.query('UPDATE app.carts SET items=$1, total_amount=$2, updated_at=now() WHERE id=$3', [itemsJson, total_amount || existing[0].total_amount || 0, existingId]);
        // refresh cart_items
        await db.query('DELETE FROM app.cart_items WHERE cart_id = $1', [existingId]);
        if (Array.isArray(items)) {
          for (const it of items) {
            const pid = safeProductId(it.product_id);
            await db.query(
              'INSERT INTO app.cart_items (cart_id, product_id, name, price, quantity, image, category) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',
              [existingId, pid, it.name || null, it.price || null, it.quantity || 1, it.image || null, it.category || null]
            );
          }
        }
        const { rows: updatedRows } = await db.query('SELECT * FROM app.carts WHERE id = $1', [existingId]);
        return res.status(200).json(updatedRows[0]);
      }
    }

    // insert cart including session_id and total_amount
    const q = `INSERT INTO app.carts (id, user_id, session_id, status, items, total_amount, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,now(),now()) RETURNING *`;
    const itemsJson = Array.isArray(items) ? JSON.stringify(items) : null;
    const status = 'active';
    const { rows } = await db.query(q, [id, user_id || null, session_id || null, status, itemsJson, total_amount || 0]);

    // store items in app.cart_items table for compatibility
    if (Array.isArray(items)) {
      for (const it of items) {
        const pid = safeProductId(it.product_id);
        await db.query(
          'INSERT INTO app.cart_items (cart_id, product_id, name, price, quantity, image, category) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',
          [id, pid, it.name || null, it.price || null, it.quantity || 1, it.image || null, it.category || null]
        );
      }
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateCart = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { items, total_amount, status } = req.body;
    // delete existing items and re-insert
    await db.query('DELETE FROM app.cart_items WHERE cart_id = $1', [id]);
    if (Array.isArray(items)) {
      for (const it of items) {
        const pid = safeProductId(it.product_id);
        await db.query(
          'INSERT INTO app.cart_items (cart_id, product_id, name, price, quantity, image, category) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',
          [id, pid, it.name || null, it.price || null, it.quantity || 1, it.image || null, it.category || null]
        );
      }
    }

    // update cart metadata and return updated row
    await db.query('UPDATE app.carts SET total_amount = COALESCE($1, total_amount), status = COALESCE($2, status), items = COALESCE($3, items), updated_at = now() WHERE id = $4', [total_amount || null, status || null, Array.isArray(items) ? JSON.stringify(items) : null, id]);
    const { rows } = await db.query('SELECT * FROM app.carts WHERE id = $1', [id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const getCartItems = async (req, res, next) => {
  try {
    const cartId = req.params.id;
    const { rows } = await db.query('SELECT * FROM app.cart_items WHERE cart_id = $1', [cartId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { getCartBySession, createCart, updateCart, getCartItems };
