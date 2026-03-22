const db = require('../config/db');
const cache = require('../lib/cache');

const listMovements = async (opts = {}) => {
  const {
    limit = 200,
    offset = 0,
    product_id = null,
    movement_type = null,
    start = null,
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

const createMovement = async (data = {}, userId = null) => {
  const {
    product_id,
    movement_type,
    movement_subtype = 'autre',
    quantity = 0,
    unit_cost = null,
    reference = null,
    order_id = null,
    order_item_id = null,
    metadata = {}
  } = data;

  if (!product_id || !movement_type || !quantity || quantity <= 0) {
    throw new Error('invalid_payload');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Adjust product stock
    let productRow;
    if (movement_type === 'in') {
      const res = await client.query('UPDATE app.products SET stock = stock + $1 WHERE id = $2 RETURNING *', [quantity, product_id]);
      productRow = res.rows[0];
    } else if (movement_type === 'out') {
      const res = await client.query('UPDATE app.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING *', [quantity, product_id]);
      productRow = res.rows[0];
      if (!productRow) {
        throw new Error('insufficient_stock');
      }
    } else {
      throw new Error('invalid_movement_type');
    }

    // Insert movement
    const insertSql = `
      INSERT INTO app.stock_mouvement (product_id, order_id, order_item_id, movement_type, movement_subtype, quantity, unit_cost, reference, created_by, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `;
    const insertParams = [product_id, order_id, order_item_id, movement_type, movement_subtype, quantity, unit_cost, reference, userId, JSON.stringify(metadata || {})];
    const { rows: insRows } = await client.query(insertSql, insertParams);
    const movement = insRows[0];

    await client.query('COMMIT');

    // Invalidate product cache(s)
    try { cache.del('products:get', { id: product_id }); cache.del('products:list', {}); } catch (e) { }

    return { movement, product: productRow };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { listMovements, createMovement };
