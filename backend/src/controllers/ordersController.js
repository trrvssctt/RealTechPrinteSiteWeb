const db = require('../config/db');
const clientModel = require('../models/clientModel');
const { randomUUID: uuidv4 } = require('crypto');
const cache = require('../lib/cache');
const n8n = require('../services/n8nWebhookService');
const { paidSql, paymentStatus, round2 } = require('../services/orderPayments');

// Valide les lignes d'une commande : les prix sont TOUJOURS relus en base, jamais
// acceptés du client. Le personnel peut saisir un prix négocié et des lignes libres.
// Retourne { items } ou { error }.
const MAX_QTY = 10000;
async function validateOrderItems(q, items, isStaff) {
  const validItems = [];
  for (const it of items) {
    const label = it.product_name || it.service_name || it.name || 'article';
    const quantity = Math.floor(Number(it.quantity || 0));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
      return { error: `Quantité invalide pour : ${label}` };
    }

    let unitPrice;
    if (it.product_id) {
      const pRes = await q.query('SELECT name, price, stock, is_active, purchase_price FROM app.products WHERE id = $1 LIMIT 1', [it.product_id]);
      const p = pRes.rows[0];
      if (!p || (!isStaff && p.is_active === false)) return { error: `Produit introuvable : ${it.product_name || it.product_id}` };
      if (quantity > Number(p.stock || 0)) return { error: `Stock insuffisant pour : ${p.name || it.product_id} (disponible : ${Number(p.stock || 0)})` };
      unitPrice = (isStaff && it.unit_price != null) ? Number(it.unit_price) : Number(p.price);
      validItems.push({ product_id: it.product_id, service_id: null, product_name: p.name || it.product_name || null, service_name: null, unit_price: unitPrice, quantity, catalog_price: Number(p.price) || 0, purchase_price: Number(p.purchase_price) || 0 });
    } else if (it.service_id) {
      // Prix d'achat : colonne, sinon ancienne valeur stockée dans metadata
      const sRes = await q.query(`SELECT name, price, COALESCE(NULLIF(purchase_price, 0), (metadata->>'purchase_price')::numeric, 0) AS purchase_price FROM app.services WHERE id = $1 LIMIT 1`, [it.service_id]);
      const s = sRes.rows[0];
      if (!s) return { error: `Service introuvable : ${it.service_name || it.service_id}` };
      unitPrice = (isStaff && it.unit_price != null) ? Number(it.unit_price) : Number(s.price || 0);
      validItems.push({ product_id: null, service_id: it.service_id, product_name: null, service_name: s.name || it.service_name || null, unit_price: unitPrice, quantity, catalog_price: Number(s.price) || 0, purchase_price: Number(s.purchase_price) || 0 });
    } else {
      // Ligne libre sans référence catalogue : réservée au personnel
      if (!isStaff) return { error: 'Article sans référence produit ou service.' };
      unitPrice = Number(it.unit_price || it.price || 0);
      validItems.push({ product_id: null, service_id: null, product_name: it.product_name || it.name || null, service_name: it.service_name || null, unit_price: unitPrice, quantity, catalog_price: unitPrice, purchase_price: 0 });
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: `Prix invalide pour : ${label}` };
  }
  return { items: validItems };
}

// Public: create an order
exports.createOrder = async (req, res, next) => {
  let tx = null; // client dédié : BEGIN/COMMIT doivent passer par la même connexion
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
      proforma_id,    // commande issue d'une facture proforma
    } = req.body;

    // Seul le personnel (admin/employé) peut créer des ventes directes, fixer des
    // prix négociés ou appliquer une remise. Le public paie toujours le tarif catalogue.
    const STAFF_ROLES = ['admin', 'employe', 'employé', 'employee', 'staff'];
    const isStaff = !!(req.user && Array.isArray(req.user.roles) && req.user.roles.some(r => STAFF_ROLES.includes(r)));
    const isDirectSale = isStaff && sale_type === 'direct_sale';
    const orderId = uuidv4();
    const orderNumber = `${isDirectSale ? 'VD' : 'CMD'}-${Date.now().toString().slice(-6)}`;

    // Transformation d'une proforma : réservée au personnel, une seule fois par proforma
    let proforma = null;
    if (proforma_id) {
      if (!isStaff) return res.status(403).json({ error: 'Transformation de proforma réservée au personnel' });
      const pr = await db.query(`SELECT id, invoice_number, status FROM app.invoices WHERE id = $1 AND invoice_type = 'proforma'`, [proforma_id]);
      proforma = pr.rows[0];
      if (!proforma) return res.status(404).json({ error: 'Proforma introuvable' });
      if (proforma.status !== 'issued') return res.status(409).json({ error: `La proforma ${proforma.invoice_number} est déjà transformée ou annulée` });
    }

    tx = await db.connect();
    await tx.query('BEGIN');

    // Try to find or create a client from provided customer info
    let client = null;

    // If client_id provided directly (admin modal), use it
    if (bodyClientId) {
      const cr = await tx.query('SELECT * FROM app.clients WHERE id = $1 LIMIT 1', [bodyClientId]);
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

    const validation = await validateOrderItems(tx, items, isStaff);
    if (validation.error) {
      await tx.query('ROLLBACK');
      return res.status(400).json({ error: validation.error });
    }
    const validItems = validation.items;

    // ── Total calculé côté serveur : somme des lignes − remise (personnel uniquement).
    //    Le total_amount envoyé par le client est ignoré.
    const itemsSum = validItems.reduce((s, it) => s + it.unit_price * it.quantity, 0);
    const rawDiscount = isStaff ? Number(discount || 0) : 0;
    const appliedDiscount = Math.min(Math.max(0, Number.isFinite(rawDiscount) ? rawDiscount : 0), itemsSum);
    const computedTotal = itemsSum - appliedDiscount;
    // Instantanés pour le calcul des marges (prix catalogue / prix d'achat relus en base)
    const catalogAmount = validItems.reduce((s, it) => s + it.catalog_price * it.quantity, 0);
    const costAmount = validItems.reduce((s, it) => s + it.purchase_price * it.quantity, 0);

    // include created_by column if present in schema (we pass userId as both user_id and created_by)
    const q = `INSERT INTO app.orders (id, user_id, created_by, client_id, status, total_amount, placed_at, shipping_address, billing_address, metadata, catalog_amount, cost_amount)
      VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10,$11) RETURNING *`;
    const clientId = client ? client.id : null;
    const userId = (req.user && req.user.id) || null;
    const createdBy = userId || null;
    const { rows } = await tx.query(q, [orderId, userId, createdBy, clientId, status, computedTotal, shipping_address || null, billing_address || null, metadata || null, catalogAmount, costAmount]);

    for (const it of validItems) {
      await tx.query(
        `INSERT INTO app.order_items (order_id, product_id, service_id, product_name, service_name, unit_price, quantity, total, catalog_price, purchase_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [orderId, it.product_id, it.service_id, it.product_name, it.service_name, it.unit_price, it.quantity, it.unit_price * it.quantity, it.catalog_price, it.purchase_price]
      );
    }

    // store customer info + sale context in metadata
    await tx.query(
      `UPDATE app.orders SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), $1, $2::jsonb, true) WHERE id = $3`,
      ['{customer}', JSON.stringify({ name: customer_name || null, phone: customer_phone || null, email: customer_email || null }), orderId]
    );
    // store sale_type, payment_method, discount, notes
    const saleContext = {
      sale_type:      isDirectSale ? 'direct_sale' : 'order',
      payment_method: payment_method || null,
      discount:       appliedDiscount,
      notes:          orderNoteBody  || null,
      ...(proforma ? { proforma_id: proforma.id, proforma_number: proforma.invoice_number } : {}),
    };
    await tx.query(
      `UPDATE app.orders SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), $1, $2::jsonb, true) WHERE id = $3`,
      ['{sale_context}', JSON.stringify(saleContext), orderId]
    );

    // If direct sale completed: decrement stock immediately + create stock_mouvement
    if (status === 'completed') {
      for (const it of validItems) {
        if (!it.product_id) continue;
        const qty = Number(it.quantity || 0);
        const upd = await tx.query(
          'UPDATE app.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock',
          [qty, it.product_id]
        );
        if (!upd.rows[0]) {
          await tx.query('ROLLBACK');
          return res.status(400).json({ error: `Stock insuffisant pour : ${it.product_name || it.product_id}` });
        }
        await tx.query(
          `INSERT INTO app.stock_mouvement (product_id, order_id, movement_type, movement_subtype, quantity, reference, created_by, metadata)
           VALUES ($1, $2, 'out', 'vente', $3, $4, $5, $6)`,
          [it.product_id, orderId, qty, orderNumber, userId, JSON.stringify({ sale_type: 'direct_sale' })]
        );
      }
    }

    // Vente directe encaissée : un versement du montant total
    if (status === 'completed' && computedTotal > 0) {
      await tx.query(
        `INSERT INTO app.payments (order_id, provider, amount, status, paid_at, created_by)
         VALUES ($1, $2, $3, 'paid', now(), $4)`,
        [orderId, payment_method || null, computedTotal, userId]
      );
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
      await tx.query(
        `UPDATE app.orders SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), $1, $2::jsonb, true) WHERE id = $3`,
        ['{traiter_par}', JSON.stringify([creator]), orderId]
      );
    } catch (e) {
      console.error('Failed to initialize traiter_par', e);
    }

    await tx.query('COMMIT');

    if (proforma) {
      await tx.query(
        `UPDATE app.invoices SET status = 'converted', converted_order_id = $1 WHERE id = $2 AND status = 'issued'`,
        [orderId, proforma.id]
      ).catch(e => console.error('[invoices] Marquage proforma transformée échoué :', e.message));
    }

    // Notification WhatsApp via n8n (fire-and-forget)
    setImmediate(async () => {
      try {
        const orderPayload = {
          ...rows[0],
          items: validItems,
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
    if (tx) await tx.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (tx) tx.release();
  }
};

// Admin: list orders with aggregated items
exports.listOrders = async (req, res, next) => {
  try {
    const { client_id, email } = req.query;
    let q = `SELECT o.*, ${paidSql('o')} AS amount_paid,
             COALESCE(jsonb_agg((to_jsonb(oi) - 'order_id') || jsonb_build_object('sku', p.sku) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
             FROM app.orders o
             LEFT JOIN app.order_items oi ON oi.order_id = o.id
             LEFT JOIN app.products p ON p.id = oi.product_id`;
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

// Personnel : modifier les lignes d'une commande tant qu'elle est EN ATTENTE
// PUT /api/admin/orders/:id/items  { items, discount?, notes?, client_id?, payment_method? }
// Les lignes sont remplacées (ajout, suppression, quantité, prix négocié) ; totaux recalculés.
exports.updateOrderItems = async (req, res, next) => {
  let tx = null;
  const id = req.params.id;
  const { items, discount, notes, client_id, payment_method } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Au moins un article est requis' });
  try {
    tx = await db.connect();
    await tx.query('BEGIN');

    const { rows: orderRows } = await tx.query(`SELECT o.*, ${paidSql('o')} AS amount_paid FROM app.orders o WHERE o.id = $1 FOR UPDATE`, [id]);
    const order = orderRows[0];
    if (!order) {
      await tx.query('ROLLBACK');
      return res.status(404).json({ error: 'Commande introuvable' });
    }
    if (order.status !== 'pending') {
      await tx.query('ROLLBACK');
      return res.status(409).json({ error: 'Seule une commande en attente peut être modifiée' });
    }

    const validation = await validateOrderItems(tx, items, true);
    if (validation.error) {
      await tx.query('ROLLBACK');
      return res.status(400).json({ error: validation.error });
    }
    const validItems = validation.items;
    const itemsSum = validItems.reduce((s, it) => s + it.unit_price * it.quantity, 0);
    const rawDiscount = discount != null ? Number(discount) : Number(order.metadata?.sale_context?.discount || 0);
    const appliedDiscount = Math.min(Math.max(0, Number.isFinite(rawDiscount) ? rawDiscount : 0), itemsSum);
    const computedTotal = round2(itemsSum - appliedDiscount);
    if (Number(order.amount_paid) > computedTotal) {
      await tx.query('ROLLBACK');
      return res.status(400).json({ error: `Le nouveau total (${computedTotal} FCFA) est inférieur au montant déjà payé (${Number(order.amount_paid)} FCFA)` });
    }
    const catalogAmount = validItems.reduce((s, it) => s + it.catalog_price * it.quantity, 0);
    const costAmount = validItems.reduce((s, it) => s + it.purchase_price * it.quantity, 0);

    // Client éventuellement changé
    let clientId = order.client_id;
    let customer = order.metadata?.customer || {};
    if (client_id && client_id !== order.client_id) {
      const cr = await tx.query('SELECT id, full_name, email, phone FROM app.clients WHERE id = $1', [client_id]);
      if (!cr.rows[0]) {
        await tx.query('ROLLBACK');
        return res.status(400).json({ error: 'Client introuvable' });
      }
      clientId = cr.rows[0].id;
      customer = { name: cr.rows[0].full_name, phone: cr.rows[0].phone, email: cr.rows[0].email };
    }

    // Commande en attente : aucun mouvement de stock n'est lié à ses lignes
    await tx.query('DELETE FROM app.order_items WHERE order_id = $1', [id]);
    for (const it of validItems) {
      await tx.query(
        `INSERT INTO app.order_items (order_id, product_id, service_id, product_name, service_name, unit_price, quantity, total, catalog_price, purchase_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, it.product_id, it.service_id, it.product_name, it.service_name, it.unit_price, it.quantity, it.unit_price * it.quantity, it.catalog_price, it.purchase_price]
      );
    }

    const saleContext = {
      ...(order.metadata?.sale_context || {}),
      discount: appliedDiscount,
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(payment_method ? { payment_method } : {}),
    };
    const actor = {
      user_id: (req.user && req.user.id) || null,
      name: (req.user && (req.user.name || req.user.email)) || null,
      roles: (req.user && req.user.roles) || null,
      action: 'edited',
      at: new Date().toISOString(),
    };
    await tx.query(
      `UPDATE app.orders
          SET total_amount = $1, catalog_amount = $2, cost_amount = $3, client_id = $4,
              metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb),
                           '{sale_context}', $5::jsonb, true),
                           '{customer}', $6::jsonb, true),
                           '{traiter_par}', COALESCE(metadata->'traiter_par', '[]'::jsonb) || jsonb_build_array($7::jsonb), true)
        WHERE id = $8`,
      [computedTotal, catalogAmount, costAmount, clientId, JSON.stringify(saleContext), JSON.stringify(customer), JSON.stringify(actor), id]
    );

    const { rows: finalRows } = await tx.query(
      `SELECT o.*, ${paidSql('o')} AS amount_paid,
              COALESCE(jsonb_agg((to_jsonb(oi) - 'order_id') || jsonb_build_object('sku', p.sku) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
         FROM app.orders o
         LEFT JOIN app.order_items oi ON oi.order_id = o.id
         LEFT JOIN app.products p ON p.id = oi.product_id
        WHERE o.id = $1
        GROUP BY o.id`,
      [id]
    );
    await tx.query('COMMIT');
    res.json({ data: finalRows[0] });
  } catch (err) {
    if (tx) await tx.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (tx) tx.release();
  }
};

// Admin: update order (status, etc.) - supports transactional stock adjustment on complete/cancel
exports.updateOrder = async (req, res, next) => {
  let tx = null; // client dédié : BEGIN/COMMIT doivent passer par la même connexion
  const id = req.params.id;
  const {
    status,
    cancel_reason,
    // Completion fields
    delivery_status,  // 'full' | 'partial' | 'none'
    payment_amount,   // montant encaissé lors de cette finalisation (versement)
    payment_method,   // 'cash' | 'wave' | 'transfer' | 'card'
    delivered_items,  // [{product_id, quantity}] — used when delivery_status='partial'
    // Cancellation fields
    returned_items,   // [{product_id, quantity}] — stock to restore on cancel
  } = req.body;

  try {
    tx = await db.connect();
    await tx.query('BEGIN');

    // load order and its items
    const orderQ = `SELECT o.* FROM app.orders o WHERE o.id = $1 FOR UPDATE`;
    const { rows: orderRows } = await tx.query(orderQ, [id]);
    const order = orderRows[0];
    if (!order) {
      await tx.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    // load items
    const { rows: items } = await tx.query('SELECT * FROM app.order_items WHERE order_id = $1', [id]);
    const createdMovementByItem = {};

    // ── Completing / Updating progress ───────────────────────────────────────
    // Accepts status='completed' from frontend; actual DB status may become
    // 'in_progress' if not fully paid AND fully delivered.
    const updatedProductIds = [];
    if (status === 'completed' && order.status !== 'completed') {

      const effDelivery = delivery_status || 'full';

      // Versement éventuel : ne peut pas dépasser le reste à payer
      const total = Number(order.total_amount) || 0;
      const { rows: paidRows } = await tx.query(`SELECT ${paidSql('o')} AS paid FROM app.orders o WHERE o.id = $1`, [id]);
      const paidBefore = round2(paidRows[0]?.paid || 0);
      const payNow = round2(payment_amount || 0);
      if (!Number.isFinite(payNow) || payNow < 0) {
        await tx.query('ROLLBACK');
        return res.status(400).json({ error: 'Montant encaissé invalide' });
      }
      if (payNow > round2(total - paidBefore)) {
        await tx.query('ROLLBACK');
        return res.status(400).json({ error: `Le montant encaissé dépasse le reste à payer (${round2(total - paidBefore)} FCFA)` });
      }
      if (payNow > 0) {
        await tx.query(
          `INSERT INTO app.payments (order_id, provider, amount, status, paid_at, created_by)
           VALUES ($1, $2, $3, 'paid', now(), $4)`,
          [id, payment_method || null, payNow, (req.user && req.user.id) || null]
        );
      }
      const amountPaid = round2(paidBefore + payNow);
      const effPayment = paymentStatus(amountPaid, total);


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
        const upd = await tx.query(
          'UPDATE app.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock',
          [it.decrement_qty, it.product_id]
        );
        if (upd.rows.length === 0) {
          await tx.query('ROLLBACK');
          return res.status(400).json({ error: `Stock insuffisant pour : ${it.product_name || it.product_id}` });
        }
        updatedProductIds.push(it.product_id);
        try {
          const mv = await tx.query(
            `INSERT INTO app.stock_mouvement (product_id, order_id, order_item_id, movement_type, movement_subtype, quantity, reference, created_by)
             VALUES ($1,$2,$3,'out','commande',$4,$5,$6) RETURNING id`,
            [it.product_id, id, it.id, it.decrement_qty, order.order_number || null, (req.user && req.user.id) || null]
          );
          if (mv.rows[0]?.id) createdMovementByItem[it.id] = mv.rows[0].id;
        } catch (e) {
          console.error('Failed to insert stock_mouvement (out) for item', it.id, e);
        }
      }

      // Build total delivered map (merge prev + new) — jamais en dessous de ce qui est déjà livré
      const totalDeliveredMap = { ...prevDeliveredMap };
      for (const [pid, qty] of Object.entries(requestedDeliveredMap)) {
        totalDeliveredMap[pid] = Math.max(qty, prevDeliveredMap[pid] || 0);
      }

      // État de livraison réel, déduit des quantités (et non du choix fait à l'écran)
      const orderedMap = {};
      for (const it of items) {
        if (it.product_id) orderedMap[it.product_id] = (orderedMap[it.product_id] || 0) + Number(it.quantity || 0);
      }
      const orderedPids = Object.keys(orderedMap);
      const deliveredCount = orderedPids.filter(pid => (totalDeliveredMap[pid] || 0) > 0).length;
      const actualDelivery = orderedPids.every(pid => (totalDeliveredMap[pid] || 0) >= orderedMap[pid])
        ? 'full'                       // tout livré (ou commande de services uniquement)
        : deliveredCount > 0 ? 'partial' : 'none';

      // An order is truly COMPLETED only when paid + fully delivered
      const targetStatus = (actualDelivery === 'full' && effPayment === 'paid')
        ? 'completed'
        : 'in_progress';

      const deliveryMeta = {
        delivery_status: actualDelivery,
        payment_status:  effPayment,
        amount_paid:     amountPaid,
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
        await tx.query(
          `UPDATE app.orders
              SET status = 'completed', completed_at = now(),
                  metadata = jsonb_set(COALESCE(metadata,'{}'), '{delivery}', $1::jsonb, true)
            WHERE id = $2`,
          [JSON.stringify(deliveryMeta), id]
        );
      } else {
        await tx.query(
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
        await tx.query(
          'UPDATE app.products SET stock = stock + $1 WHERE id = $2',
          [ri.restore_qty, ri.product_id]
        );
        restoredProductIds.push(ri.product_id);

        try {
          // Sorties d'origine : par ligne de commande, sinon par produit (les ventes
          // directes enregistrent leur sortie sans order_item_id). Elles ne sont
          // annulées que si tout ce qui était sorti revient en stock ; sur un retour
          // partiel elles restent actives et seule l'entrée « retour » est ajoutée.
          const { rows: outs } = await tx.query(
            `SELECT id, quantity FROM app.stock_mouvement
              WHERE order_id = $1 AND movement_type = 'out' AND status = 'active'
                AND (order_item_id = $2 OR (order_item_id IS NULL AND product_id = $3))
              ORDER BY created_at DESC`,
            [id, ri.order_item_id, ri.product_id]
          );
          const origId = outs[0]?.id || null;
          const totalOut = outs.reduce((sum, m) => sum + Number(m.quantity || 0), 0);
          if (outs.length && ri.restore_qty >= totalOut) {
            await tx.query(
              `UPDATE app.stock_mouvement SET status='voided', cancelled_at=now(), cancel_reason=$1 WHERE id = ANY($2::uuid[])`,
              [cancel_reason || null, outs.map(m => m.id)]
            );
          }
          await tx.query(
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
      await tx.query(
        `UPDATE app.orders
            SET status = $1,
                cancelled_at = now(),
                cancel_reason = $2,
                metadata = jsonb_set(COALESCE(metadata,'{}'), '{cancellation}', $3::jsonb, true)
          WHERE id = $4`,
        [status, cancel_reason || null, JSON.stringify(returnMeta), id]
      );

      // L'argent de la vente ne doit plus être compté nulle part : les versements
      // passent « remboursés » et les factures émises « annulées » (numéro conservé).
      await tx.query(
        `UPDATE app.payments
            SET status = 'refunded',
                note = CONCAT_WS(' — ', NULLIF(note, ''), 'Commande annulée le ' || to_char(now() AT TIME ZONE 'Africa/Dakar', 'DD/MM/YYYY'))
          WHERE order_id = $1 AND status = 'paid'`,
        [id]
      );
      await tx.query(
        `UPDATE app.invoices SET status = 'cancelled'
          WHERE order_id = $1 AND status = 'issued' AND invoice_type <> 'proforma'`,
        [id]
      );
    }

    // Generic status update for other transitions (pending, etc.)
    if (status && status !== 'completed' && status !== 'cancelled' && status !== 'in_progress') {
      await tx.query('UPDATE app.orders SET status = $1 WHERE id = $2', [status, id]);
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
      await tx.query(
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
    const q = `SELECT o.*, ${paidSql('o')} AS amount_paid,
               COALESCE(jsonb_agg((to_jsonb(oi) - 'order_id') || jsonb_build_object('sku', p.sku) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
               FROM app.orders o
               LEFT JOIN app.order_items oi ON oi.order_id = o.id
               LEFT JOIN app.products p ON p.id = oi.product_id
               WHERE o.id = $1
               GROUP BY o.id`;
    const { rows: finalRows } = await tx.query(q, [id]);

    await tx.query('COMMIT');

    // Notification WhatsApp via n8n (fire-and-forget)
    setImmediate(async () => {
      try {
        const updatedOrder = finalRows[0];
        // Un versement partiel laisse la commande « en cours » : pas de notification de vente
        if (status === 'completed' && updatedOrder?.status === 'completed') {
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
    if (tx) await tx.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (tx) tx.release();
  }
};
