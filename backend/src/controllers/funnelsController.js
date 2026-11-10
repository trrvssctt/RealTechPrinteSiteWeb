// API admin des funnels promo (admin uniquement) : funnels, réglages de paiement,
// commandes du funnel et confirmation des paiements.
// Confirmer un paiement passe par les contrôleurs existants : la commande apparaît dans
// Commandes, le versement est enregistré et la facture définitive est émise dans Factures.
const db = require('../config/db');
const ordersController = require('./ordersController');
const invoicesController = require('./invoicesController');
const {
  METHODS, SETTINGS_KEY, HOLDING_SQL, getPaymentSettings, funnelState,
  variantsWithAvailability, callHandler, emitEvent,
} = require('../services/funnelService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_SLUGS = ['orders', 'commande'];
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

const slugify = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, 60);

// ── Funnels ──────────────────────────────────────────────────────────────────

// Statistiques par funnel (visites, commandes transmises, à traiter, CA confirmé)
const FUNNEL_STATS_SQL = `
  SELECT f.*, p.name AS product_name, p.sku AS product_sku, p.price AS regular_price,
         p.stock AS product_stock, COALESCE(f.image_url, p.image_url) AS image,
         (SELECT MIN(v.price) FROM app.funnel_variants v WHERE v.funnel_id = f.id AND v.is_active) AS promo_price,
         (SELECT COALESCE(SUM(v.stock), 0) FROM app.funnel_variants v WHERE v.funnel_id = f.id AND v.is_active)::int AS promo_stock,
         (SELECT COALESCE(SUM(fo.quantity), 0) FROM app.funnel_orders fo WHERE fo.funnel_id = f.id AND ${HOLDING_SQL('fo')})::int AS held,
         (SELECT COUNT(*) FROM app.funnel_orders fo WHERE fo.funnel_id = f.id
            AND fo.status IN ('declared', 'cod_pending', 'not_received', 'confirming', 'paid'))::int AS orders_count,
         (SELECT COUNT(*) FROM app.funnel_orders fo WHERE fo.funnel_id = f.id AND fo.status IN ('declared', 'cod_pending'))::int AS to_process,
         (SELECT COUNT(*) FROM app.funnel_orders fo WHERE fo.funnel_id = f.id AND fo.status = 'paid')::int AS paid_count,
         (SELECT COALESCE(SUM(fo.total_amount), 0) FROM app.funnel_orders fo WHERE fo.funnel_id = f.id AND fo.status = 'paid') AS revenue
    FROM app.funnels f
    JOIN app.products p ON p.id = f.product_id`;

const withState = (f) => ({ ...f, state: funnelState(f), regular_price: Number(f.regular_price), promo_price: f.promo_price != null ? Number(f.promo_price) : null, revenue: Number(f.revenue || 0) });

// GET /api/admin/funnels
exports.list = async (req, res, next) => {
  try {
    const { rows } = await db.query(`${FUNNEL_STATS_SQL} ORDER BY f.created_at DESC`);
    res.json({ data: rows.map(withState) });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/funnels/summary — cartes de la liste et badge du menu
exports.summary = async (req, res, next) => {
  try {
    const { rows: funnels } = await db.query('SELECT is_published, starts_at, ends_at FROM app.funnels');
    const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('declared', 'cod_pending', 'not_received', 'confirming', 'paid')
                           AND COALESCE(declared_at, created_at) >= now() - interval '30 days')::int AS orders_30d,
        COUNT(*) FILTER (WHERE status IN ('declared', 'cod_pending'))::int AS to_process,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid' AND confirmed_at >= now() - interval '30 days'), 0) AS revenue_30d
      FROM app.funnel_orders`);
    res.json({
      data: {
        online: funnels.filter((f) => funnelState(f) === 'online').length,
        orders_30d: rows[0].orders_30d,
        to_process: rows[0].to_process,
        revenue_30d: Number(rows[0].revenue_30d),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/funnels/:id
exports.get = async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Funnel introuvable' });
    const { rows } = await db.query(`${FUNNEL_STATS_SQL} WHERE f.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Funnel introuvable' });
    const variants = await variantsWithAvailability(req.params.id);
    res.json({ data: { ...withState(rows[0]), variants } });
  } catch (err) {
    next(err);
  }
};

// Valide le corps d'un funnel ; renvoie { data } ou { error }
async function validateFunnel(b, funnelId = null) {
  const title = clean(b.title, 120);
  if (title.length < 3) return { error: 'Le titre est obligatoire' };
  if (!UUID_RE.test(String(b.product_id || ''))) return { error: 'Choisissez un produit du catalogue' };
  const { rows: pr } = await db.query('SELECT id FROM app.products WHERE id = $1 AND deleted_at IS NULL', [b.product_id]);
  if (!pr[0]) return { error: 'Produit introuvable' };

  const slug = slugify(b.slug || title);
  if (!slug || RESERVED_SLUGS.includes(slug)) return { error: 'Adresse de la page invalide' };
  const { rows: dup } = await db.query('SELECT id FROM app.funnels WHERE slug = $1 AND id IS DISTINCT FROM $2', [slug, funnelId]);
  if (dup[0]) return { error: `L'adresse /promo/${slug} est déjà utilisée par un autre funnel` };

  const date = (v) => (v ? new Date(v) : null);
  const startsAt = date(b.starts_at);
  const endsAt = date(b.ends_at);
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) return { error: 'Dates invalides' };
  if (startsAt && endsAt && endsAt <= startsAt) return { error: 'La fin de l\'offre doit être après le début' };

  const maxQty = Math.floor(Number(b.max_qty || 3));
  if (!Number.isFinite(maxQty) || maxQty < 1 || maxQty > 100) return { error: 'Quantité max. par commande invalide (1 à 100)' };

  const variants = Array.isArray(b.variants) ? b.variants : [];
  if (variants.filter((v) => v.is_active !== false).length === 0) return { error: 'Ajoutez au moins une formule active' };
  const cleanVariants = [];
  for (const [i, v] of variants.entries()) {
    const label = clean(v.label, 120);
    const price = Number(v.price);
    const stock = Math.floor(Number(v.stock));
    if (!label) return { error: `Formule ${i + 1} : nom obligatoire` };
    if (!Number.isFinite(price) || price < 0) return { error: `Formule « ${label} » : prix invalide` };
    if (!Number.isFinite(stock) || stock < 0) return { error: `Formule « ${label} » : stock invalide` };
    cleanVariants.push({ id: UUID_RE.test(String(v.id || '')) ? v.id : null, label, price, stock, is_active: v.is_active !== false, position: i });
  }

  const pm = b.payment_methods || {};
  return {
    data: {
      title,
      slug,
      product_id: b.product_id,
      description: clean(b.description, 2000) || null,
      bullets: (Array.isArray(b.bullets) ? b.bullets : []).map((x) => clean(x, 160)).filter(Boolean).slice(0, 8),
      image_url: clean(b.image_url, 500) || null,
      starts_at: startsAt,
      ends_at: endsAt,
      is_published: !!b.is_published,
      max_qty: maxQty,
      payment_methods: Object.fromEntries(METHODS.map((m) => [m, pm[m] !== false])),
      confirmation_message: clean(b.confirmation_message, 600) || null,
      variants: cleanVariants,
    },
  };
}

async function saveVariants(tx, funnelId, variants) {
  const { rows: existing } = await tx.query('SELECT id FROM app.funnel_variants WHERE funnel_id = $1', [funnelId]);
  const keep = new Set();
  for (const v of variants) {
    if (v.id && existing.some((e) => e.id === v.id)) {
      await tx.query(
        'UPDATE app.funnel_variants SET label = $1, price = $2, stock = $3, is_active = $4, position = $5 WHERE id = $6',
        [v.label, v.price, v.stock, v.is_active, v.position, v.id]
      );
      keep.add(v.id);
    } else {
      const { rows } = await tx.query(
        'INSERT INTO app.funnel_variants (funnel_id, label, price, stock, is_active, position) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [funnelId, v.label, v.price, v.stock, v.is_active, v.position]
      );
      keep.add(rows[0].id);
    }
  }
  // Formule retirée : supprimée si elle n'a jamais été commandée, sinon simplement désactivée
  for (const e of existing.filter((x) => !keep.has(x.id))) {
    const { rows } = await tx.query('SELECT 1 FROM app.funnel_orders WHERE variant_id = $1 LIMIT 1', [e.id]);
    if (rows[0]) await tx.query('UPDATE app.funnel_variants SET is_active = false WHERE id = $1', [e.id]);
    else await tx.query('DELETE FROM app.funnel_variants WHERE id = $1', [e.id]);
  }
}

async function saveFunnel(req, res, next, funnelId) {
  let tx = null;
  try {
    if (funnelId && !UUID_RE.test(funnelId)) return res.status(404).json({ error: 'Funnel introuvable' });
    const v = await validateFunnel(req.body || {}, funnelId);
    if (v.error) return res.status(400).json({ error: v.error });
    const d = v.data;
    const cols = [d.title, d.slug, d.product_id, d.description, JSON.stringify(d.bullets), d.image_url, d.starts_at, d.ends_at,
      d.is_published, d.max_qty, JSON.stringify(d.payment_methods), d.confirmation_message];

    tx = await db.connect();
    await tx.query('BEGIN');
    let id = funnelId;
    if (funnelId) {
      const { rowCount } = await tx.query(
        `UPDATE app.funnels SET title = $1, slug = $2, product_id = $3, description = $4, bullets = $5::jsonb, image_url = $6,
                starts_at = $7, ends_at = $8, is_published = $9, max_qty = $10, payment_methods = $11::jsonb,
                confirmation_message = $12, updated_at = now()
          WHERE id = $13`,
        [...cols, funnelId]
      );
      if (!rowCount) {
        await tx.query('ROLLBACK');
        return res.status(404).json({ error: 'Funnel introuvable' });
      }
    } else {
      const { rows } = await tx.query(
        `INSERT INTO app.funnels (title, slug, product_id, description, bullets, image_url, starts_at, ends_at,
                                  is_published, max_qty, payment_methods, confirmation_message, created_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13) RETURNING id`,
        [...cols, req.user?.id || null]
      );
      id = rows[0].id;
    }
    await saveVariants(tx, id, d.variants);
    await tx.query('COMMIT');
    tx.release();
    tx = null;
    req.params.id = id;
    res.status(funnelId ? 200 : 201);
    return exports.get(req, res, next);
  } catch (err) {
    if (tx) await tx.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'Cette adresse de page est déjà utilisée' });
    next(err);
  } finally {
    if (tx) tx.release();
  }
}

// POST /api/admin/funnels
exports.create = (req, res, next) => saveFunnel(req, res, next, null);
// PUT /api/admin/funnels/:id
exports.update = (req, res, next) => saveFunnel(req, res, next, req.params.id);

// DELETE /api/admin/funnels/:id — impossible dès qu'une commande existe (repasser en brouillon)
exports.remove = async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Funnel introuvable' });
    const { rows } = await db.query('SELECT 1 FROM app.funnel_orders WHERE funnel_id = $1 LIMIT 1', [req.params.id]);
    if (rows[0]) return res.status(409).json({ error: 'Ce funnel a des commandes : repassez-le en brouillon au lieu de le supprimer' });
    const r = await db.query('DELETE FROM app.funnels WHERE id = $1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Funnel introuvable' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// ── Réglages de paiement ─────────────────────────────────────────────────────

exports.getSettings = async (req, res, next) => {
  try {
    res.json({ data: await getPaymentSettings() });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const b = req.body || {};
    const transfer = (m) => ({
      enabled: !!b[m]?.enabled,
      number: clean(b[m]?.number, 30),
      holder: clean(b[m]?.holder, 60),
    });
    const value = {
      wave: transfer('wave'),
      orange_money: transfer('orange_money'),
      cod: {
        enabled: !!b.cod?.enabled,
        zones: clean(b.cod?.zones, 200),
        max_amount: Math.max(0, Math.floor(Number(b.cod?.max_amount) || 0)),
      },
      reservation_minutes: Math.floor(Number(b.reservation_minutes) || 30),
      team_email: clean(b.team_email, 160),
      team_whatsapp: clean(b.team_whatsapp, 30),
    };
    for (const m of ['wave', 'orange_money']) {
      if (value[m].enabled && value[m].number.replace(/\D/g, '').length < 8) {
        return res.status(400).json({ error: `Numéro ${m === 'wave' ? 'Wave' : 'Orange Money'} invalide` });
      }
    }
    if (value.reservation_minutes < 5 || value.reservation_minutes > 1440) {
      return res.status(400).json({ error: 'Durée de réservation : entre 5 minutes et 24 heures' });
    }
    if (value.team_email && !EMAIL_RE.test(value.team_email)) return res.status(400).json({ error: 'Email de l\'équipe invalide' });

    await db.query(
      `INSERT INTO app.settings (key, value, description, updated_at) VALUES ($1, $2::jsonb, 'Funnels promo : moyens de paiement et alertes', now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [SETTINGS_KEY, JSON.stringify(value)]
    );
    res.json({ data: value });
  } catch (err) {
    next(err);
  }
};

// ── Commandes du funnel ──────────────────────────────────────────────────────

// GET /api/admin/funnels/:id/orders — sans les réservations en cours de paiement expirées
exports.listOrders = async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Funnel introuvable' });
    const { rows } = await db.query(
      `SELECT fo.id, fo.ref, fo.status, fo.variant_label, fo.quantity, fo.unit_price, fo.total_amount,
              fo.customer_name, fo.customer_phone, fo.customer_email, fo.reception, fo.address,
              fo.payment_method, fo.expires_at, fo.declared_at, fo.confirmed_at, fo.cancelled_at, fo.cancel_reason,
              fo.created_at, fo.order_id, fo.invoice_id,
              (fo.status = 'reserved' AND fo.expires_at <= now()) AS is_expired,
              inv.invoice_number, u.full_name AS confirmed_by_name
         FROM app.funnel_orders fo
         LEFT JOIN app.invoices inv ON inv.id = fo.invoice_id
         LEFT JOIN app.users u ON u.id = fo.confirmed_by
        WHERE fo.funnel_id = $1
        ORDER BY COALESCE(fo.declared_at, fo.created_at) DESC`,
      [req.params.id]
    );
    res.json({
      data: rows.map((r) => ({
        ...r,
        status: r.is_expired ? 'expired' : r.status,
        unit_price: Number(r.unit_price),
        total_amount: Number(r.total_amount),
      })),
    });
  } catch (err) {
    next(err);
  }
};

const fail = (r, fallback) => {
  const e = new Error(r.body?.error || fallback);
  e.status = r.status >= 400 && r.status < 500 ? 400 : 500;
  return e;
};

// POST /api/admin/funnels/orders/:orderId/confirm { delivered?: boolean }
// Paiement reçu (ou encaissé à la livraison) : commande + versement + facture définitive.
// Chaque étape est mémorisée : en cas d'erreur, un nouvel essai reprend là où il s'est arrêté.
exports.confirmOrder = async (req, res, next) => {
  const id = req.params.orderId;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Commande introuvable' });
  let prevStatus = null;
  try {
    const { rows } = await db.query(
      `UPDATE app.funnel_orders fo SET status = 'confirming', updated_at = now()
         FROM (SELECT id, status AS prev FROM app.funnel_orders WHERE id = $1 FOR UPDATE) old
        WHERE fo.id = old.id AND old.prev IN ('declared', 'cod_pending', 'not_received')
        RETURNING fo.*, old.prev`,
      [id]
    );
    if (!rows[0]) return res.status(409).json({ error: 'Cette commande n\'est pas en attente de confirmation' });
    let fo = rows[0];
    prevStatus = fo.prev;
    const { rows: fr } = await db.query('SELECT title, slug FROM app.funnels WHERE id = $1', [fo.funnel_id]);
    const funnel = fr[0];
    const user = req.user;
    const delivered = req.body?.delivered === undefined ? fo.payment_method === 'cod' : !!req.body.delivered;

    // 1. Commande (reprend la proforma si elle est encore émise)
    if (!fo.order_id) {
      let proformaId;
      if (fo.proforma_id) {
        const { rows: pr } = await db.query(`SELECT status FROM app.invoices WHERE id = $1`, [fo.proforma_id]);
        if (pr[0]?.status === 'issued') proformaId = fo.proforma_id;
      }
      const r = await callHandler(ordersController.createOrder, {
        user,
        body: {
          customer_name: fo.customer_name,
          customer_phone: fo.customer_phone,
          customer_email: fo.customer_email,
          customer_address: fo.address || (fo.reception === 'pickup' ? "Retrait à l'atelier" : null),
          items: [{ product_id: fo.product_id, quantity: fo.quantity, unit_price: Number(fo.unit_price) }],
          sale_type: 'order',
          initial_status: 'pending',
          payment_method: fo.payment_method === 'cod' ? 'cash' : 'wave',
          notes: `Funnel promo « ${funnel.title} » — ${fo.variant_label} — réf ${fo.ref}`,
          proforma_id: proformaId,
          metadata: { from_funnel: funnel.slug, funnel_order_ref: fo.ref, funnel_variant: fo.variant_label, reception: fo.reception },
        },
      });
      if (r.status !== 201) throw fail(r, 'Création de la commande impossible');
      fo.order_id = r.body.data.id;
      await db.query('UPDATE app.funnel_orders SET order_id = $1 WHERE id = $2', [fo.order_id, id]);
    }

    // 2. Versement (et livraison si déjà faite) : même logique que « Finaliser la commande »
    const { rows: paid } = await db.query(`SELECT 1 FROM app.payments WHERE order_id = $1 AND status = 'paid' LIMIT 1`, [fo.order_id]);
    if (!paid[0]) {
      const r = await callHandler(ordersController.updateOrder, {
        user,
        params: { id: fo.order_id },
        body: {
          status: 'completed',
          delivery_status: delivered ? 'full' : 'none',
          payment_amount: Number(fo.total_amount),
          payment_method: fo.payment_method === 'cod' ? 'cash' : 'wave',
        },
      });
      if (r.status !== 200) throw fail(r, 'Enregistrement du paiement impossible');
    }

    // 3. Facture définitive (payée)
    if (!fo.invoice_id) {
      const r = await callHandler(invoicesController.createFromOrder, { user, body: { order_id: fo.order_id } });
      if (r.status !== 200 && r.status !== 201) throw fail(r, 'Création de la facture impossible');
      fo.invoice_id = r.body.data.id;
    }

    const { rows: done } = await db.query(
      `UPDATE app.funnel_orders SET status = 'paid', invoice_id = $1, confirmed_at = now(), confirmed_by = $2, updated_at = now()
        WHERE id = $3 RETURNING *`,
      [fo.invoice_id, user?.id || null, id]
    );
    emitEvent('funnel.payment_confirmed', id);
    res.json({ data: done[0] });
  } catch (err) {
    if (prevStatus) {
      await db.query(`UPDATE app.funnel_orders SET status = $1, updated_at = now() WHERE id = $2 AND status = 'confirming'`, [prevStatus, id]).catch(() => {});
    }
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
};

// POST /api/admin/funnels/orders/:orderId/not-received — relance du client (mail)
exports.markNotReceived = async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.orderId)) return res.status(404).json({ error: 'Commande introuvable' });
    const { rows } = await db.query(
      `UPDATE app.funnel_orders SET status = 'not_received', updated_at = now()
        WHERE id = $1 AND status IN ('declared', 'cod_pending') RETURNING *`,
      [req.params.orderId]
    );
    if (!rows[0]) return res.status(409).json({ error: 'Cette commande n\'est pas en attente de confirmation' });
    emitEvent('funnel.payment_not_received', rows[0].id);
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/funnels/orders/:orderId/cancel { reason } — stock promo libéré, proforma annulée
exports.cancelOrder = async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.orderId)) return res.status(404).json({ error: 'Commande introuvable' });
    const reason = clean(req.body?.reason, 300);
    if (!reason) return res.status(400).json({ error: 'Indiquez le motif de l\'annulation' });
    const { rows } = await db.query(
      `UPDATE app.funnel_orders SET status = 'cancelled', cancel_reason = $2, cancelled_at = now(), updated_at = now()
        WHERE id = $1 AND status IN ('reserved', 'declared', 'cod_pending', 'not_received') RETURNING *`,
      [req.params.orderId, reason]
    );
    if (!rows[0]) return res.status(409).json({ error: 'Cette commande ne peut plus être annulée ici (déjà payée ou annulée)' });
    if (rows[0].proforma_id) {
      await db.query(`UPDATE app.invoices SET status = 'cancelled' WHERE id = $1 AND status = 'issued'`, [rows[0].proforma_id]);
    }
    emitEvent('funnel.order_cancelled', rows[0].id);
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};
