const db = require('../config/db');
const { getOrderState, paidSql, round2 } = require('../services/orderPayments');

// Types de facture gérés. Toutes partagent la même numérotation séquentielle.
const INVOICE_TYPES = ['definitive', 'acompte', 'proforma'];
const MAX_QTY = 10000;

// Attribue le numéro et insère la facture dans UNE seule instruction SQL :
// si l'INSERT échoue, l'incrément du compteur est annulé avec lui (pas de trou).
const INSERT_INVOICE_SQL = `
  WITH c AS (
    INSERT INTO app.invoice_counters (year, last_value)
    VALUES (EXTRACT(YEAR FROM now() AT TIME ZONE 'Africa/Dakar')::int, 1)
    ON CONFLICT (year) DO UPDATE SET last_value = app.invoice_counters.last_value + 1
    RETURNING year, last_value
  )
  INSERT INTO app.invoices (
    invoice_year, invoice_seq, invoice_number, invoice_type, order_id, client_id,
    client, items, subtotal, discount, total_amount, acompte_amount, payment_method, notes, created_by, order_state
  )
  SELECT c.year, c.last_value, 'FAC-' || c.year || '-' || lpad(c.last_value::text, 5, '0'),
         $1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13::jsonb
  FROM c
  RETURNING *`;

function insertInvoice(f) {
  return db.query(INSERT_INVOICE_SQL, [
    f.invoice_type,
    f.order_id || null,
    f.client_id || null,
    JSON.stringify(f.client || {}),
    JSON.stringify(f.items || []),
    f.subtotal,
    f.discount,
    f.total_amount,
    f.acompte_amount ?? null,
    f.payment_method || null,
    f.notes || null,
    f.created_by || null,
    f.order_state ? JSON.stringify(f.order_state) : null,
  ]);
}

// ── Factures liées à une commande : jamais figées ─────────────────────────────
// Articles, client, montants, type et état de paiement sont recalculés à partir de
// la commande à chaque lecture (seuls le numéro et la date d'émission sont fixes).
// Payée en partie → acompte (non payée) ; payée en totalité → définitive (payée).
async function computeFromOrder(orderId) {
  const result = await getOrderState(orderId);
  if (!result) return null;
  const { order, state } = result;

  const { rows: itemRows } = await db.query(
    `SELECT oi.*, p.sku FROM app.order_items oi
       LEFT JOIN app.products p ON p.id = oi.product_id
      WHERE oi.order_id = $1 ORDER BY oi.id`,
    [orderId]
  );
  const items = itemRows.map(it => ({
    product_id: it.product_id,
    service_id: it.service_id,
    name: it.product_name || it.service_name || 'Article',
    sku: it.sku || (it.service_id ? 'SERVICE' : null),
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    total: Number(it.total),
  }));

  let clientRec = null;
  if (order.client_id) {
    const cr = await db.query('SELECT full_name, phone, email FROM app.clients WHERE id = $1', [order.client_id]);
    clientRec = cr.rows[0] || null;
  }
  const customer = order.metadata?.customer || {};
  const saleContext = order.metadata?.sale_context || {};

  return {
    order,
    fields: {
      invoice_type: state.amount_paid <= 0 ? null : state.payment_status === 'paid' ? 'definitive' : 'acompte',
      client_id: order.client_id,
      client: {
        name: clientRec?.full_name || customer.name || null,
        phone: clientRec?.phone || customer.phone || null,
        email: clientRec?.email || customer.email || null,
      },
      items,
      subtotal: round2(items.reduce((s, it) => s + it.total, 0)),
      discount: round2(saleContext.discount || 0),
      total_amount: Number(order.total_amount) || 0,
      acompte_amount: state.amount_paid,
      payment_method: saleContext.payment_method || null,
      notes: saleContext.notes || null,
      order_state: state,
    },
  };
}

// Recalcule une facture liée à une commande et met à jour sa copie en base
// (utile pour la recherche et les filtres). Proforma : renvoyée telle quelle.
async function refreshInvoice(row) {
  if (!row.order_id || row.invoice_type === 'proforma') return row;
  const computed = await computeFromOrder(row.order_id);
  if (!computed) return row; // commande supprimée : dernière version connue
  const f = { ...computed.fields, invoice_type: computed.fields.invoice_type || row.invoice_type };
  const { rows } = await db.query(
    `UPDATE app.invoices
        SET invoice_type = $1, client_id = $2, client = $3::jsonb, items = $4::jsonb, subtotal = $5,
            discount = $6, total_amount = $7, acompte_amount = $8, payment_method = $9, notes = $10,
            order_state = $11::jsonb
      WHERE id = $12
      RETURNING *`,
    [f.invoice_type, f.client_id, JSON.stringify(f.client), JSON.stringify(f.items), f.subtotal, f.discount,
     f.total_amount, f.acompte_amount, f.payment_method, f.notes, JSON.stringify(f.order_state), row.id]
  );
  return { ...rows[0], order_status: computed.order.status };
}

// Liste des factures avec type, montant payé, total et client calculés en direct
// depuis la commande. Filtres : type, status, order_id, client_id, q, limit, offset.
// client_id couvre les factures de ses commandes et ses proformas.
async function queryInvoices({ type, status, order_id, client_id, q, limit = 200, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (type && INVOICE_TYPES.includes(type)) { params.push(type); where.push(`x.invoice_type = $${params.length}`); }
  if (status) { params.push(status); where.push(`x.status = $${params.length}`); }
  if (order_id) { params.push(order_id); where.push(`x.order_id = $${params.length}`); }
  if (client_id) { params.push(client_id); where.push(`x.client_id = $${params.length}`); }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(x.invoice_number ILIKE $${params.length} OR x.client->>'name' ILIKE $${params.length} OR x.client->>'phone' ILIKE $${params.length})`);
  }
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT x.* FROM (
       SELECT i.id, i.invoice_year, i.invoice_seq, i.invoice_number, i.status, i.order_id, i.converted_order_id,
              i.issued_at, i.created_by, i.payment_method, i.notes, i.discount, i.subtotal, i.items, i.order_state,
              u.full_name AS created_by_name,
              o.status AS order_status,
              CASE WHEN o.id IS NULL THEN i.invoice_type
                   WHEN ${paidSql('o')} >= o.total_amount THEN 'definitive'
                   ELSE 'acompte' END AS invoice_type,
              COALESCE(o.total_amount, i.total_amount) AS total_amount,
              CASE WHEN o.id IS NULL THEN i.acompte_amount ELSE ${paidSql('o')} END AS acompte_amount,
              COALESCE(o.client_id, i.client_id) AS client_id,
              CASE WHEN o.id IS NULL THEN i.client
                   ELSE jsonb_build_object(
                     'name',  COALESCE(c.full_name, o.metadata->'customer'->>'name', i.client->>'name'),
                     'phone', COALESCE(c.phone,     o.metadata->'customer'->>'phone', i.client->>'phone'),
                     'email', COALESCE(c.email,     o.metadata->'customer'->>'email', i.client->>'email'))
              END AS client
         FROM app.invoices i
         LEFT JOIN app.orders o ON o.id = i.order_id AND i.invoice_type <> 'proforma'
         LEFT JOIN app.clients c ON c.id = o.client_id
         LEFT JOIN app.users u ON u.id = i.created_by
     ) x
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY x.invoice_year DESC, x.invoice_seq DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}
exports.queryInvoices = queryInvoices;

// GET /api/admin/invoices?type=&status=&order_id=&client_id=&q=&limit=&offset=
exports.listInvoices = async (req, res, next) => {
  try {
    const { type, status, order_id, client_id, q } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    res.json({ data: await queryInvoices({ type, status, order_id, client_id, q, limit, offset }) });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/invoices/:id — toujours recalculée depuis la commande
exports.getInvoice = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM app.invoices WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Facture introuvable' });
    res.json({ data: await refreshInvoice(rows[0]) });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/invoices/from-order  { order_id }
// Une seule facture par commande : son numéro est attribué à la première génération,
// puis elle suit la commande (articles, paiements, statut). Il faut au moins un versement.
exports.createFromOrder = async (req, res, next) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id requis' });

    const computed = await computeFromOrder(order_id);
    if (!computed) return res.status(404).json({ error: 'Commande introuvable' });
    if (computed.order.status === 'cancelled') return res.status(400).json({ error: 'Impossible de facturer une commande annulée' });
    if (!computed.fields.invoice_type) {
      return res.status(400).json({
        error: "Aucun paiement enregistré sur cette commande. Enregistrez un versement via « Finaliser la commande », ou émettez une proforma.",
      });
    }

    const findExisting = () => db.query(
      `SELECT * FROM app.invoices WHERE order_id = $1 AND invoice_type <> 'proforma' AND status <> 'cancelled'
        ORDER BY invoice_year, invoice_seq LIMIT 1`,
      [order_id]
    );
    const { rows: existing } = await findExisting();
    if (existing[0]) return res.json({ data: await refreshInvoice(existing[0]), reused: true });

    let inserted;
    try {
      inserted = await insertInvoice({ ...computed.fields, order_id, created_by: req.user?.id });
    } catch (e) {
      // Deux générations simultanées : on renvoie celle qui a gagné
      if (e.code === '23505') {
        const { rows } = await findExisting();
        if (rows[0]) return res.json({ data: await refreshInvoice(rows[0]), reused: true });
      }
      throw e;
    }
    res.status(201).json({ data: { ...inserted.rows[0], order_status: computed.order.status } });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/invoices/proforma
// { client_id?, client?: {name, phone, email}, items: [{product_id|service_id|name, quantity, unit_price?}], discount?, notes? }
// Indépendante de toute commande ; le stock n'est vérifié qu'à la transformation en commande.
exports.createProforma = async (req, res, next) => {
  try {
    const { client_id, items, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Au moins un article est requis' });

    const validItems = [];
    for (const it of items) {
      const quantity = Math.floor(Number(it.quantity || 0));
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
        return res.status(400).json({ error: `Quantité invalide pour : ${it.name || it.product_name || it.service_name || 'article'}` });
      }
      let line;
      if (it.product_id) {
        const { rows } = await db.query('SELECT name, price, sku FROM app.products WHERE id = $1', [it.product_id]);
        if (!rows[0]) return res.status(400).json({ error: `Produit introuvable : ${it.product_id}` });
        line = { product_id: it.product_id, service_id: null, name: rows[0].name, sku: rows[0].sku || null, catalog: Number(rows[0].price) };
      } else if (it.service_id) {
        const { rows } = await db.query('SELECT name, price FROM app.services WHERE id = $1', [it.service_id]);
        if (!rows[0]) return res.status(400).json({ error: `Service introuvable : ${it.service_id}` });
        line = { product_id: null, service_id: it.service_id, name: rows[0].name, sku: 'SERVICE', catalog: Number(rows[0].price || 0) };
      } else {
        const name = (it.name || '').toString().trim();
        if (!name) return res.status(400).json({ error: 'Article sans référence ni désignation' });
        line = { product_id: null, service_id: null, name, sku: null, catalog: 0 };
      }
      const unitPrice = it.unit_price != null && it.unit_price !== '' ? Number(it.unit_price) : line.catalog;
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({ error: `Prix invalide pour : ${line.name}` });
      }
      const { catalog, ...rest } = line;
      validItems.push({ ...rest, quantity, unit_price: round2(unitPrice), total: round2(unitPrice * quantity) });
    }

    const subtotal = round2(validItems.reduce((s, it) => s + it.total, 0));
    const rawDiscount = Number(req.body.discount || 0);
    const discount = round2(Math.min(Math.max(0, Number.isFinite(rawDiscount) ? rawDiscount : 0), subtotal));

    let client = {
      name: req.body.client?.name || null,
      phone: req.body.client?.phone || null,
      email: req.body.client?.email || null,
    };
    let clientId = null;
    if (client_id) {
      const cr = await db.query('SELECT id, full_name, phone, email FROM app.clients WHERE id = $1', [client_id]);
      if (!cr.rows[0]) return res.status(400).json({ error: 'Client introuvable' });
      clientId = cr.rows[0].id;
      client = { name: cr.rows[0].full_name, phone: cr.rows[0].phone, email: cr.rows[0].email };
    }
    if (!client.name && !client.phone) return res.status(400).json({ error: 'Nom ou téléphone du client requis' });

    const { rows } = await insertInvoice({
      invoice_type: 'proforma',
      client_id: clientId,
      client,
      items: validItems,
      subtotal,
      discount,
      total_amount: round2(subtotal - discount),
      notes,
      created_by: req.user?.id,
    });
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/invoices/:id/cancel — le numéro reste attribué (pas de trou), la facture passe « annulée »
exports.cancelInvoice = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE app.invoices SET status = 'cancelled' WHERE id = $1 AND status = 'issued' RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Facture introuvable ou déjà annulée / transformée' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};
