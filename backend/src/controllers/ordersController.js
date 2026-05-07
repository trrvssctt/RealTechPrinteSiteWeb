const db = require('../config/db');
const clientModel = require('../models/clientModel');
const { randomUUID: uuidv4 } = require('crypto');
const cache = require('../lib/cache');
const n8n = require('../services/n8nWebhookService');

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

    const {
      sale_type,      // 'order' | 'direct_sale'
      initial_status, // 'pending' | 'completed' (direct_sale only)
      payment_method,
      discount,
      notes: orderNoteBody,
      client_id: bodyClientId,
    } = req.body;

    const isDirectSale = sale_type === 'direct_sale';
    const orderId = uuidv4();
    const orderNumber = `${isDirectSale ? 'VD' : 'CMD'}-${Date.now().toString().slice(-6)}`;

    await db.query('BEGIN');

    // Try to find or create a client from provided customer info
    let client = null;

    // If client_id provided directly (admin modal), use it
    if (bodyClientId) {
      const cr = await db.query('SELECT * FROM app.clients WHERE id = $1 LIMIT 1', [bodyClientId]);
      client = cr.rows[0] || null;
    }
    if (!client && customer_email) {
      client = await clientModel.getClientByEmail(customer_email);
    }
    if (!client && customer_phone) {
      client = await clientModel.getClientByPhone(customer_phone);
    }
    if (!client && (customer_email || customer_name)) {
      // create client with channel = site_web or manual
      try {
        const channel = isDirectSale ? 'manual' : 'site_web';
        client = await clientModel.createClient({ full_name: customer_name || null, email: customer_email || null, phone: customer_phone || null, created_by_channel: channel });
      } catch (e) {
        console.error('client create error', e);
        client = null;
      }
    }

    // Determine initial status
    const status = (isDirectSale && initial_status === 'completed') ? 'completed' : 'pending';

        // include created_by column if present in schema (we pass userId as both user_id and created_by)
        const q = `INSERT INTO app.orders (id, user_id, created_by, client_id, status, total_amount, placed_at, shipping_address, billing_address, metadata)
          VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9) RETURNING *`;
    const clientId = client ? client.id : null;
    const userId = (req.user && req.user.id) || null;
    const createdBy = userId || null;
    const { rows } = await db.query(q, [orderId, userId, createdBy, clientId, status, total_amount || 0, shipping_address || null, billing_address || null, metadata || null]);

    // verify stock for each item and insert order_items
    for (const it of items) {
      const qty = Number(it.quantity || 0);

      if (it.product_id) {
        const pRes = await db.query('SELECT stock, price FROM app.products WHERE id = $1 LIMIT 1', [it.product_id]);
        const pRow = pRes.rows[0];
        const stock = pRow ? Number(pRow.stock || 0) : 0;
        if (qty > stock) {
          await db.query('ROLLBACK');
          return res.status(400).json({ error: `Insufficient stock for product ${it.product_name || it.product_id}` });
        }
      } else if (it.service_id) {
        await db.query('SELECT price FROM app.services WHERE id = $1 LIMIT 1', [it.service_id]);
      }

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

    // store customer info + sale context in metadata
    await db.query(
      `UPDATE app.orders SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), $1, $2::jsonb, true) WHERE id = $3`,
      ['{customer}', JSON.stringify({ name: customer_name || null, phone: customer_phone || null, email: customer_email || null }), orderId]
    );
    // store sale_type, payment_method, discount, notes
    const saleContext = {
      sale_type:      sale_type      || 'order',
      payment_method: payment_method || null,
      discount:       discount       != null ? Number(discount) : 0,
      notes:          orderNoteBody  || null,
    };
    await db.query(
      `UPDATE app.orders SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), $1, $2::jsonb, true) WHERE id = $3`,
      ['{sale_context}', JSON.stringify(saleContext), orderId]
    );

    // If direct sale completed: decrement stock immediately + create stock_mouvement
    if (status === 'completed') {
      for (const it of items) {
        if (!it.product_id) continue;
        const qty = Number(it.quantity || 0);
        const upd = await db.query(
          'UPDATE app.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock',
          [qty, it.product_id]
        );
        if (!upd.rows[0]) {
          await db.query('ROLLBACK');
          return res.status(400).json({ error: `Stock insuffisant pour : ${it.product_name || it.product_id}` });
        }
        await db.query(
          `INSERT INTO app.stock_mouvement (product_id, order_id, movement_type, movement_subtype, quantity, reference, created_by, metadata)
           VALUES ($1, $2, 'out', 'vente', $3, $4, $5, $6)`,
          [it.product_id, orderId, qty, orderNumber, userId, JSON.stringify({ sale_type: 'direct_sale' })]
        );
      }
    }

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

    // Notification WhatsApp via n8n (fire-and-forget)
    setImmediate(async () => {
      try {
        const orderPayload = {
          ...rows[0],
          items,
          client_name: client?.full_name || customer_name || null,
        };
        if (status === 'completed') {
          await n8n.notifySaleCompleted(orderPayload);
        } else {
          await n8n.notifyOrderCreated(orderPayload);
        }
      } catch (e) {
        console.warn('[n8n] Notification création commande échouée :', e.message);
      }
    });

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
  const {
    status,
    cancel_reason,
    // Completion fields
    delivery_status,  // 'full' | 'partial' | 'none'
    payment_status,   // 'paid' | 'unpaid'
    delivered_items,  // [{product_id, quantity}] — used when delivery_status='partial'
    // Cancellation fields
    returned_items,   // [{product_id, quantity}] — stock to restore on cancel
  } = req.body;

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
    const createdMovementByItem = {};

    // ── Completing / Updating progress ───────────────────────────────────────
    // Accepts status='completed' from frontend; actual DB status may become
    // 'in_progress' if not fully paid AND fully delivered.
    const updatedProductIds = [];
    if (status === 'completed' && order.status !== 'completed') {

      const effDelivery = delivery_status || 'full';
      const effPayment  = payment_status  || 'paid';

      // An order is truly COMPLETED only when paid + fully delivered
      const targetStatus = (effDelivery === 'full' && effPayment === 'paid')
        ? 'completed'
        : 'in_progress';

      // Recover quantities already delivered (for in_progress re-submission)
      const prevDeliveredMap = {}; // product_id → already_delivered_qty
      if (order.status === 'in_progress') {
        const prev = order.metadata?.delivery?.delivered_items || [];
        for (const d of prev) {
          if (d.product_id) prevDeliveredMap[d.product_id] = Number(d.delivered_qty || 0);
        }
      }

      // Build requested total delivered quantities
      const requestedDeliveredMap = {}; // product_id → total_to_deliver_now
      if (effDelivery === 'full') {
        for (const it of items) {
          if (it.product_id) requestedDeliveredMap[it.product_id] = Number(it.quantity || 0);
        }
      } else if (effDelivery === 'partial' && Array.isArray(delivered_items)) {
        for (const di of delivered_items) {
          const qty = Number(di.quantity || 0);
          if (di.product_id && qty > 0) requestedDeliveredMap[di.product_id] = qty;
        }
      }
      // effDelivery === 'none' → requestedDeliveredMap stays empty

      // Compute incremental quantities to decrement (new - already done)
      const itemsToDecrement = [];
      for (const [pid, totalQty] of Object.entries(requestedDeliveredMap)) {
        const alreadyQty = prevDeliveredMap[pid] || 0;
        const newQty = totalQty - alreadyQty;
        if (newQty <= 0) continue;
        const orderItem = items.find(it => it.product_id === pid);
        if (orderItem) itemsToDecrement.push({ ...orderItem, decrement_qty: newQty });
      }

      // Decrement stock for each incremental delivery
      for (const it of itemsToDecrement) {
        const upd = await db.query(
          'UPDATE app.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock',
          [it.decrement_qty, it.product_id]
        );
        if (upd.rows.length === 0) {
          await db.query('ROLLBACK');
          return res.status(400).json({ error: `Stock insuffisant pour : ${it.product_name || it.product_id}` });
        }
        updatedProductIds.push(it.product_id);
        try {
          const mv = await db.query(
            `INSERT INTO app.stock_mouvement (product_id, order_id, order_item_id, movement_type, movement_subtype, quantity, reference, created_by)
             VALUES ($1,$2,$3,'out','commande',$4,$5,$6) RETURNING id`,
            [it.product_id, id, it.id, it.decrement_qty, order.order_number || null, (req.user && req.user.id) || null]
          );
          if (mv.rows[0]?.id) createdMovementByItem[it.id] = mv.rows[0].id;
        } catch (e) {
          console.error('Failed to insert stock_mouvement (out) for item', it.id, e);
        }
      }

      // Build total delivered map (merge prev + new)
      const totalDeliveredMap = { ...prevDeliveredMap };
      for (const [pid, qty] of Object.entries(requestedDeliveredMap)) {
        totalDeliveredMap[pid] = qty; // total requested (not incremental)
      }

      const deliveryMeta = {
        delivery_status: effDelivery,
        payment_status:  effPayment,
        delivered_items: Object.entries(totalDeliveredMap).map(([pid, qty]) => {
          const oi = items.find(it => it.product_id === pid);
          return {
            product_id:    pid,
            product_name:  oi?.product_name || null,
            ordered_qty:   Number(oi?.quantity || 0),
            delivered_qty: qty,
          };
        }),
      };

      if (targetStatus === 'completed') {
        await db.query(
          `UPDATE app.orders
              SET status = 'completed', completed_at = now(),
                  metadata = jsonb_set(COALESCE(metadata,'{}'), '{delivery}', $1::jsonb, true)
            WHERE id = $2`,
          [JSON.stringify(deliveryMeta), id]
        );
      } else {
        await db.query(
          `UPDATE app.orders
              SET status = 'in_progress',
                  metadata = jsonb_set(COALESCE(metadata,'{}'), '{delivery}', $1::jsonb, true)
            WHERE id = $2`,
          [JSON.stringify(deliveryMeta), id]
        );
      }
    }

    // ── Cancelling ────────────────────────────────────────────────────────────
    const restoredProductIds = [];
    if (status === 'cancelled' && order.status !== 'cancelled') {
      // Determine which quantities to restore.
      // If the caller provided returned_items, use those exact quantities.
      // Otherwise fall back to old behavior (restore all if was completed).
      let itemsToRestore = []; // [{product_id, restore_qty, order_item_id}]

      const prevDelivery = order.metadata?.delivery;

      if (Array.isArray(returned_items)) {
        // Caller specified exact returned quantities
        for (const ri of returned_items) {
          const qty = Number(ri.quantity || 0);
          if (!ri.product_id || qty <= 0) continue;
          const orderItem = items.find(it => it.product_id === ri.product_id);
          itemsToRestore.push({
            product_id: ri.product_id,
            restore_qty: qty,
            order_item_id: orderItem?.id || null,
          });
        }
      } else if (order.status === 'completed' || order.status === 'in_progress') {
        // Legacy: no returned_items provided — restore whatever was delivered
        const deliveredList = prevDelivery?.delivered_items;
        if (Array.isArray(deliveredList) && deliveredList.length > 0) {
          for (const dl of deliveredList) {
            if (!dl.product_id || !dl.delivered_qty) continue;
            const orderItem = items.find(it => it.product_id === dl.product_id);
            itemsToRestore.push({
              product_id: dl.product_id,
              restore_qty: Number(dl.delivered_qty),
              order_item_id: orderItem?.id || null,
            });
          }
        } else {
          // Old orders without delivery metadata → restore all
          for (const it of items) {
            if (!it.product_id) continue;
            itemsToRestore.push({
              product_id: it.product_id,
              restore_qty: Number(it.quantity || 0),
              order_item_id: it.id,
            });
          }
        }
      }

      // Restore stock
      for (const ri of itemsToRestore) {
        await db.query(
          'UPDATE app.products SET stock = stock + $1 WHERE id = $2',
          [ri.restore_qty, ri.product_id]
        );
        restoredProductIds.push(ri.product_id);

        try {
          let origId = null;
          if (ri.order_item_id) {
            const find = await db.query(
              `SELECT id FROM app.stock_mouvement WHERE order_id=$1 AND order_item_id=$2 AND movement_type='out' AND status='active' ORDER BY created_at DESC LIMIT 1`,
              [id, ri.order_item_id]
            );
            if (find.rows[0]) origId = find.rows[0].id;
          }
          if (origId) {
            await db.query(
              `UPDATE app.stock_mouvement SET status='voided', cancelled_at=now(), cancel_reason=$1 WHERE id=$2`,
              [cancel_reason || null, origId]
            );
          }
          await db.query(
            `INSERT INTO app.stock_mouvement (product_id, order_id, order_item_id, movement_type, movement_subtype, quantity, reference, related_movement_id, created_by)
             VALUES ($1,$2,$3,'in','retour_annulation',$4,$5,$6,$7)`,
            [ri.product_id, id, ri.order_item_id, ri.restore_qty, (order.order_number || null), origId, (req.user && req.user.id) || null]
          );
        } catch (e) {
          console.error('Failed to record stock_mouvement for cancellation (in)', ri.product_id, e);
        }
      }

      // Store returned info in metadata
      const returnMeta = { returned_items: itemsToRestore.map(ri => ({ product_id: ri.product_id, returned_qty: ri.restore_qty })) };
      await db.query(
        `UPDATE app.orders
            SET status = $1,
                cancelled_at = now(),
                cancel_reason = $2,
                metadata = jsonb_set(COALESCE(metadata,'{}'), '{cancellation}', $3::jsonb, true)
          WHERE id = $4`,
        [status, cancel_reason || null, JSON.stringify(returnMeta), id]
      );
    }

    // Generic status update for other transitions (pending, etc.)
    if (status && status !== 'completed' && status !== 'cancelled' && status !== 'in_progress') {
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

    // Notification WhatsApp via n8n (fire-and-forget)
    setImmediate(async () => {
      try {
        const updatedOrder = finalRows[0];
        if (status === 'completed') {
          await n8n.notifySaleCompleted(updatedOrder);
        } else if (status === 'cancelled') {
          await n8n.notifyOrderCancelled({ ...updatedOrder, cancel_reason });
        }
      } catch (e) {
        console.warn('[n8n] Notification update commande échouée :', e.message);
      }
    });

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
