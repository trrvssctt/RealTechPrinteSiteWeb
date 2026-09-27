const db = require('../config/db');
const cache = require('../lib/cache');

const listMovements = async (opts = {}) => {
  const {
    limit = 200,
    offset = 0,
    product_id = null,
    movement_type = null,
    start = null,
    end = null,
  } = opts;

  const params = [];
  let idx = 1;
  let where = ' WHERE 1=1';
  if (product_id) {
    where += ` AND sm.product_id = $${idx}`;
    params.push(product_id);
    idx++;
  }
  if (movement_type) {
    where += ` AND sm.movement_type = $${idx}`;
    params.push(movement_type);
    idx++;
  }
  if (start) {
    where += ` AND sm.created_at >= $${idx}`;
    params.push(start);
    idx++;
  }
  if (end) {
    where += ` AND sm.created_at <= $${idx}`;
    params.push(end);
    idx++;
  }

  const sql = `
    SELECT sm.*, p.name AS product_name, u.full_name AS created_by_name
    FROM app.stock_mouvement sm
    LEFT JOIN app.products p ON p.id = sm.product_id
    LEFT JOIN app.users u ON u.id = sm.created_by
    ${where}
    ORDER BY sm.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  params.push(limit, offset);
  const { rows } = await db.query(sql, params);
  return rows;
};

// Applique un mouvement (ajuste le stock + insère la ligne) dans la transaction `client`.
async function applyMovement(client, data, userId) {
  const {
    product_id,
    movement_type,
    movement_subtype = 'autre',
    quantity = 0,
    unit_cost = null,
    reference = null,
    order_id = null,
    order_item_id = null,
    note = null,
    metadata = {}
  } = data;

  const qty = Math.floor(Number(quantity));
  if (!product_id || !movement_type || !Number.isFinite(qty) || qty <= 0) {
    throw new Error('invalid_payload');
  }

  // Adjust product stock
  let productRow;
  if (movement_type === 'in') {
    const res = await client.query('UPDATE app.products SET stock = stock + $1 WHERE id = $2 RETURNING *', [qty, product_id]);
    productRow = res.rows[0];
    if (!productRow) throw new Error('invalid_payload');
  } else if (movement_type === 'out') {
    const res = await client.query('UPDATE app.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING *', [qty, product_id]);
    productRow = res.rows[0];
    if (!productRow) {
      const err = new Error('insufficient_stock');
      err.product_id = product_id;
      throw err;
    }
  } else {
    throw new Error('invalid_movement_type');
  }

  const meta = { ...(metadata || {}), ...(note ? { note } : {}) };
  const { rows } = await client.query(
    `INSERT INTO app.stock_mouvement (product_id, order_id, order_item_id, movement_type, movement_subtype, quantity, unit_cost, reference, created_by, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [product_id, order_id, order_item_id, movement_type, movement_subtype, qty, unit_cost, reference, userId, JSON.stringify(meta)]
  );
  return { movement: rows[0], product: productRow };
}

const createMovement = async (data = {}, userId = null) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await applyMovement(client, data, userId);
    await client.query('COMMIT');
    try { cache.clear(); } catch (e) { }
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Plusieurs produits en une seule opération (même type, motif, référence et note).
// Tout ou rien : si un produit n'a pas assez de stock, aucun mouvement n'est enregistré.
const createMovementsBatch = async (data = {}, userId = null) => {
  const { movement_type, movement_subtype, reference, note, metadata = {}, items } = data;
  if (!Array.isArray(items) || items.length === 0) throw new Error('invalid_payload');

  // Un même produit saisi deux fois : quantités additionnées
  const merged = new Map();
  for (const it of items) {
    if (!it || !it.product_id) throw new Error('invalid_payload');
    merged.set(it.product_id, (merged.get(it.product_id) || 0) + Number(it.quantity || 0));
  }

  const batchId = require('crypto').randomUUID();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const [product_id, quantity] of merged) {
      results.push(await applyMovement(client, {
        product_id, movement_type, movement_subtype, quantity, reference, note,
        metadata: { ...metadata, batch_id: batchId, batch_size: merged.size },
      }, userId));
    }
    await client.query('COMMIT');
    try { cache.clear(); } catch (e) { }
    return { batchId, results };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { listMovements, createMovement, createMovementsBatch };

