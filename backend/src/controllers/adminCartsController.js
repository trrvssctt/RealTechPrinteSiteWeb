const db = require('../config/db');

// List all carts with aggregated items (admin only)
// NOTE: some deployments have different cart schemas. Avoid referencing columns
// that may not exist (e.g. last_activity_at, session_id). We gather basic
// columns and map `updated_at` -> `last_activity_at` for compatibility.
exports.listCarts = async (req, res, next) => {
  try {
    const { client_id, email } = req.query;
    let q = `SELECT
         c.id,
         c.session_id,
         c.user_id,
         c.status,
         c.total_amount,
         c.created_at,
         c.updated_at,
         COALESCE(jsonb_agg(to_jsonb(ci) - 'cart_id' ORDER BY ci.id) FILTER (WHERE ci.id IS NOT NULL), '[]') AS items
       FROM app.carts c
       LEFT JOIN app.cart_items ci ON ci.cart_id = c.id`;
    const where = [];
    const params = [];
    if (client_id) {
      params.push(client_id);
      // some deployments may store client id in user_id or session metadata; try matching user_id
      where.push(`c.user_id = $${params.length}`);
    }
    if (email) {
      params.push(`%${email}%`);
      // best-effort: search the JSON `items` column (stringified) for the email
      where.push(`COALESCE(c.items::text, '') ILIKE $${params.length}`);
    }
    if (where.length > 0) q += ` WHERE ` + where.join(' AND ');
    q += ` GROUP BY c.id ORDER BY c.updated_at DESC`;
    const { rows } = await db.query(q, params);

    // Normalize rows so frontend can expect last_activity_at and some other fields.
    const normalized = rows.map(r => ({
      id: r.id,
      session_id: r.session_id || null,
      user_id: r.user_id || null,
      status: r.status || 'active',
      total_amount: r.total_amount || 0,
      created_at: r.created_at,
      // map updated_at to last_activity_at for compatibility
      last_activity_at: r.updated_at,
      items: r.items || []
    }));

    res.json({ data: normalized });
  } catch (err) {
    next(err);
  }
};

// Delete a cart (and its items)
exports.deleteCart = async (req, res, next) => {
  const cartId = req.params.id;
  try {
    await db.query('BEGIN');
    await db.query('DELETE FROM app.cart_items WHERE cart_id = $1', [cartId]);
    const { rows } = await db.query('DELETE FROM app.carts WHERE id = $1 RETURNING *', [cartId]);
    await db.query('COMMIT');
    res.json({ data: rows[0] || null });
  } catch (err) {
    await db.query('ROLLBACK');
    next(err);
  }
};
