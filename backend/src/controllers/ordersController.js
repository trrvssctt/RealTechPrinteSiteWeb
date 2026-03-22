const db = require('../config/db');
const clientModel = require('../models/clientModel');
const { v4: uuidv4 } = require('uuid');
const cache = require('../lib/cache');

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

    // Try to find or create a client from provided customer info
    let client = null;
    if (customer_email) {
      client = await clientModel.getClientByEmail(customer_email);
    }
    if (!client && customer_phone) {
      client = await clientModel.getClientByPhone(customer_phone);
    }
    if (!client) {
      // create client with channel = site_web
      try {
        client = await clientModel.createClient({ full_name: customer_name || null, email: customer_email || null, phone: customer_phone || null, created_by_channel: 'site_web' });
      } catch (e) {
        // ignore create errors (unique constraints) and continue without client
        console.error('client create error', e);
        client = null;
      }
    }

        // include created_by column if present in schema (we pass userId as both user_id and created_by)
        const q = `INSERT INTO app.orders (id, user_id, created_by, client_id, status, total_amount, placed_at, shipping_address, billing_address, metadata)
          VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9) RETURNING *`;
    const status = 'pending';
    const clientId = client ? client.id : null;
    const userId = (req.user && req.user.id) || null;
    const createdBy = userId || null;
    const { rows } = await db.query(q, [orderId, userId, createdBy, clientId, status, total_amount || 0, shipping_address || null, billing_address || null, metadata || null]);

    // verify stock for each item and insert order_items
    for (const it of items) {
      const qty = Number(it.quantity || 0);
      if (it.product_id) {
        const pRes = await db.query('SELECT stock FROM app.products WHERE id = $1 LIMIT 1', [it.product_id]);
        const stock = pRes.rows[0] ? Number(pRes.rows[0].stock || 0) : 0;
        if (qty > stock) {
          await db.query('ROLLBACK');
          return res.status(400).json({ error: `Insufficient stock for product ${it.product_name || it.product_id}` });
        }
      }

      // Support both product items and service items in order_items
      const unitPrice = Number(it.unit_price || it.price || 0);
      const quantity = Number(it.quantity || 1);
      const total = unitPrice * quantity;

      await db.query(
        `INSERT INTO app.order_items (order_id, product_id, service_id, product_name, service_name, unit_price, quantity, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          orderId,
          it.product_id || null,
          it.service_id || null,
          it.product_name || it.name || null,
          it.service_name || it.name || null,
          unitPrice,
          quantity,
          total
        ]
      );
    }

    // store basic customer info in metadata for now
    await db.query(
      `UPDATE app.orders SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), $1, $2::jsonb, true) WHERE id = $3`,
      ['{customer}', JSON.stringify({ name: customer_name || null, phone: customer_phone || null, email: customer_email || null }), orderId]
    );

    // initialize traiter_par in metadata with creator info
    try {
      const creator = {
        user_id: userId || null,
        name: (req.user && (req.user.name || req.user.email)) || null,
        roles: (req.user && req.user.roles) || null,
        action: 'created',
        first_at: new Date().toISOString(),
        last_at: new Date().toISOString(),
        count: 1
      };
      await db.query(
        `UPDATE app.orders SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), $1, $2::jsonb, true) WHERE id = $3`,
        ['{traiter_par}', JSON.stringify([creator]), orderId]
      );
    } catch (e) {
      console.error('Failed to initialize traiter_par', e);
    }

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
    const { client_id, email } = req.query;
    let q = `SELECT o.*, COALESCE(jsonb_agg(to_jsonb(oi) - 'order_id' ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
             FROM app.orders o
             LEFT JOIN app.order_items oi ON oi.order_id = o.id`;
    const where = [];
    const params = [];
    if (client_id) {
      params.push(client_id);
      where.push(`o.client_id = $${params.length}`);
    }
    if (email) {
      params.push(email);
      // try matching client email FK or embedded metadata customer email
      where.push(`(o.client_id IN (SELECT id FROM app.clients WHERE email = $${params.length}) OR (COALESCE(o.metadata->'customer'->> 'email','') = $${params.length}))`);
    }
    if (where.length > 0) q += ` WHERE ` + where.join(' AND ');
    q += ` GROUP BY o.id ORDER BY o.placed_at DESC`;
    const { rows } = await db.query(q, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

// Admin: update order (status, etc.) - supports transactional stock adjustment on complete/cancel
exports.updateOrder = async (req, res, next) => {
  const id = req.params.id;
  const { status, cancel_reason } = req.body;
  try {
    await db.query('BEGIN');

    // load order and its items
    const orderQ = `SELECT o.* FROM app.orders o WHERE o.id = $1 FOR UPDATE`;
    const { rows: orderRows } = await db.query(orderQ, [id]);
    const order = orderRows[0];
    if (!order) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    // load items
    const { rows: items } = await db.query('SELECT * FROM app.order_items WHERE order_id = $1', [id]);
    // map to store created movement ids for this transaction (keyed by order_item id)
    const createdMovementByItem = {};

    // If marking completed: decrement stock atomically
    const updatedProductIds = [];
    if (status === 'completed' && order.status !== 'completed') {
      for (const it of items) {
        if (!it.product_id) continue;
        const qty = Number(it.quantity || 0);
        const upd = await db.query(
          'UPDATE app.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock',
          [qty, it.product_id]
        );
        if (upd.rows.length === 0) {
          await db.query('ROLLBACK');
          return res.status(400).json({ error: `Insufficient stock for product ${it.product_name || it.product_id}` });
        }
        updatedProductIds.push(it.product_id);
        // insert stock movement record (out)
        try {
          const mv = await db.query(
            `INSERT INTO app.stock_mouvement (product_id, order_id, order_item_id, movement_type, movement_subtype, quantity, reference, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [it.product_id, id, it.id, 'out', 'commande', qty, (order.order_number || null), (req.user && req.user.id) || null]
          );
          if (mv.rows[0] && mv.rows[0].id) createdMovementByItem[it.id] = mv.rows[0].id;
        } catch (e) {
          // do not fail the whole transaction for logging error, but log it
          console.error('Failed to insert stock_mouvement (out) for item', it.id, e);
        }
      }
      await db.query("UPDATE app.orders SET status = 'completed', completed_at = now() WHERE id = $1", [id]);
    }

    // If cancelling: if previously completed, restore stock; record cancel reason
    const restoredProductIds = [];
    if (status === 'cancelled' && order.status !== 'cancelled') {
      if (order.status === 'completed') {
        for (const it of items) {
          if (!it.product_id) continue;
          await db.query('UPDATE app.products SET stock = stock + $1 WHERE id = $2', [Number(it.quantity || 0), it.product_id]);
          restoredProductIds.push(it.product_id);
          // try to find the outgoing movement for this order_item and mark it voided, then insert a restoring movement
          try {
            // try to find movement created in this transaction first
            let origId = createdMovementByItem[it.id] || null;
            if (!origId) {
              const find = await db.query(
                `SELECT id FROM app.stock_mouvement WHERE order_id = $1 AND order_item_id = $2 AND movement_type = 'out' AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
                [id, it.id]
              );
              if (find.rows[0]) origId = find.rows[0].id;
            }

            if (origId) {
              await db.query(`UPDATE app.stock_mouvement SET status = 'voided', cancelled_at = now(), cancel_reason = $1 WHERE id = $2`, [cancel_reason || null, origId]);
            }

            const mvIn = await db.query(
              `INSERT INTO app.stock_mouvement (product_id, order_id, order_item_id, movement_type, movement_subtype, quantity, reference, related_movement_id, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
              [it.product_id, id, it.id, 'in', 'annulation_commande', Number(it.quantity || 0), (order.order_number || null), origId, (req.user && req.user.id) || null]
            );
            // you may want to store mvIn.rows[0].id somewhere or log it
          } catch (e) {
            console.error('Failed to record stock_mouvement for cancellation (in) for item', it.id, e);
          }
        }
      }
      await db.query('UPDATE app.orders SET status = $1, cancelled_at = now(), cancel_reason = $2 WHERE id = $3', [status, cancel_reason || null, id]);
    }

    // Generic status update for other transitions
    if (status && status !== 'completed' && status !== 'cancelled') {
      await db.query('UPDATE app.orders SET status = $1 WHERE id = $2', [status, id]);
    }

    // Append the actor into metadata.traiter_par (jsonb array) so every update records who acted
    try {
      const actor = {
        user_id: (req.user && req.user.id) || null,
        name: (req.user && (req.user.name || req.user.email)) || null,
        roles: (req.user && req.user.roles) || null,
        action: status || 'update',
        at: new Date().toISOString()
      };

      // Use jsonb operations to append the actor object to the traiter_par array (create if missing)
      await db.query(
        `UPDATE app.orders SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{traiter_par}',
           COALESCE(metadata->'traiter_par','[]'::jsonb) || jsonb_build_array($1::jsonb),
           true
         ) WHERE id = $2`,
        [JSON.stringify(actor), id]
      );
    } catch (e) {
      console.error('Failed to record traiter_par metadata', e);
    }

    // return enriched order with items
    const q = `SELECT o.*, COALESCE(jsonb_agg(to_jsonb(oi) - 'order_id' ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
               FROM app.orders o
               LEFT JOIN app.order_items oi ON oi.order_id = o.id
               WHERE o.id = $1
               GROUP BY o.id`;
    const { rows: finalRows } = await db.query(q, [id]);

    await db.query('COMMIT');

    // Invalidate product caches for affected products so stock changes are reflected
    try {
      const affected = Array.from(new Set([...(updatedProductIds || []), ...(restoredProductIds || [])]));
      if (affected.length > 0) {
        affected.forEach(pid => {
          try { cache.del('products:get', { id: pid }); } catch (e) {}
        });
        // Clear list caches to be safe (simple app-level cache)
        try { cache.clear(); } catch (e) {}
      }
    } catch (e) {
      // ignore cache clearing errors
    }

    res.json({ data: finalRows[0] || null });
  } catch (err) {
    await db.query('ROLLBACK');
    next(err);
  }
};
