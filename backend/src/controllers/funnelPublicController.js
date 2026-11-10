// API publique des funnels promo : page promo, réservation, suivi par lien privé.
// Ne renvoie jamais les données d'autres clients : la commande n'est lisible
// qu'avec son jeton aléatoire (access_token).
const crypto = require('crypto');
const db = require('../config/db');
const invoicesController = require('./invoicesController');
const {
  METHOD_LABELS, RECEPTION_LABELS, getPaymentSettings, enabledMethods, funnelState,
  variantsWithAvailability, callHandler, emitEvent,
} = require('../services/funnelService');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

async function loadFunnelBySlug(slug, q = db) {
  const { rows } = await q.query(
    `SELECT f.*, p.name AS product_name, p.price AS regular_price, p.stock AS product_stock,
            p.image_url AS product_image, p.short_description AS product_short_description,
            c.name AS category_name,
            COALESCE((SELECT json_agg(pi.url ORDER BY pi.position) FROM app.product_images pi
                       WHERE pi.product_id = p.id), '[]'::json) AS product_images
       FROM app.funnels f
       JOIN app.products p ON p.id = f.product_id
       LEFT JOIN app.categories c ON c.id = p.category_id
      WHERE f.slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

// Moyens de paiement présentés au client (numéros inclus : ils sont affichés publiquement)
function publicPayment(settings, funnel) {
  const methods = enabledMethods(settings, funnel);
  return {
    methods: methods.map((m) => ({
      key: m,
      label: METHOD_LABELS[m],
      ...(m === 'cod'
        ? { zones: settings.cod.zones || '', max_amount: Number(settings.cod.max_amount) || 0 }
        : { number: settings[m].number, holder: settings[m].holder }),
    })),
    reservation_minutes: Number(settings.reservation_minutes) || 30,
  };
}

// GET /api/funnels/:slug
exports.getFunnel = async (req, res, next) => {
  try {
    const f = await loadFunnelBySlug(req.params.slug);
    const state = f ? funnelState(f) : null;
    if (!f || state === 'draft') return res.status(404).json({ error: 'Offre introuvable' });

    const settings = await getPaymentSettings();
    const variants = (await variantsWithAvailability(f.id, db, { activeOnly: true }))
      .map((v) => ({ id: v.id, label: v.label, price: v.price, stock: Number(v.stock), available: Math.min(v.available, Math.max(0, Number(f.product_stock) || 0)) }));
    // Galerie du funnel si elle a été composée, sinon les photos du produit
    const images = (Array.isArray(f.images) && f.images.length ? f.images : [f.image_url, f.product_image, ...(f.product_images || [])]).filter(Boolean);

    res.json({
      data: {
        slug: f.slug,
        title: f.title,
        description: f.description || f.product_short_description || '',
        bullets: Array.isArray(f.bullets) ? f.bullets : [],
        category: f.category_name || null,
        images: [...new Set(images)],
        regular_price: Number(f.regular_price) || 0,
        starts_at: f.starts_at,
        ends_at: f.ends_at,
        state,
        max_qty: f.max_qty,
        variants,
        payment: publicPayment(settings, f),
        whatsapp: settings.team_whatsapp || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/funnels/:slug/visit — compteur de visites de la page promo
exports.trackVisit = async (req, res, next) => {
  try {
    await db.query('UPDATE app.funnels SET visits = visits + 1 WHERE slug = $1 AND is_published', [req.params.slug]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// POST /api/funnels/:slug/orders — réserve le stock promo et renvoie le lien privé
// { variant_id, quantity, name, phone, email?, reception: 'delivery'|'pickup', address? }
exports.createReservation = async (req, res, next) => {
  let tx = null;
  try {
    const b = req.body || {};
    const name = clean(b.name, 120);
    const phone = clean(b.phone, 30);
    const email = clean(b.email, 160).toLowerCase() || null;
    const reception = b.reception === 'pickup' ? 'pickup' : 'delivery';
    const address = clean(b.address, 300) || null;
    const quantity = Math.floor(Number(b.quantity || 0));

    if (name.length < 2) return res.status(400).json({ error: 'Indiquez votre nom complet' });
    if (phone.replace(/\D/g, '').length < 8) return res.status(400).json({ error: 'Numéro WhatsApp invalide' });
    if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Adresse email invalide' });
    if (reception === 'delivery' && !address) return res.status(400).json({ error: 'Indiquez votre adresse de livraison' });

    const f = await loadFunnelBySlug(req.params.slug);
    if (!f || funnelState(f) !== 'online') return res.status(410).json({ error: "Cette offre n'est plus disponible" });
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > f.max_qty) {
      return res.status(400).json({ error: `Quantité invalide (maximum ${f.max_qty} par commande)` });
    }

    const settings = await getPaymentSettings();
    if (enabledMethods(settings, f).length === 0) {
      return res.status(503).json({ error: 'Aucun moyen de paiement disponible pour le moment' });
    }

    tx = await db.connect();
    await tx.query('BEGIN');
    // Verrou sur la formule : deux clients ne peuvent pas réserver la dernière unité
    const { rows: vr } = await tx.query(
      'SELECT * FROM app.funnel_variants WHERE id = $1 AND funnel_id = $2 AND is_active FOR UPDATE',
      [b.variant_id, f.id]
    );
    const variant = vr[0];
    if (!variant) {
      await tx.query('ROLLBACK');
      return res.status(400).json({ error: 'Formule introuvable' });
    }
    const [avail] = (await variantsWithAvailability(f.id, tx)).filter((v) => v.id === variant.id);
    if (quantity > avail.available || quantity > Number(f.product_stock || 0)) {
      await tx.query('ROLLBACK');
      return res.status(409).json({ error: 'Plus assez de stock au prix promo pour cette quantité' });
    }

    const unitPrice = Number(variant.price);
    const minutes = Number(settings.reservation_minutes) || 30;
    const token = crypto.randomBytes(24).toString('base64url');
    const { rows } = await tx.query(
      `INSERT INTO app.funnel_orders
         (funnel_id, variant_id, variant_label, product_id, quantity, unit_price, total_amount,
          customer_name, customer_phone, customer_email, reception, address, expires_at, access_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now() + make_interval(mins => $13), $14)
       RETURNING ref, expires_at, total_amount`,
      [f.id, variant.id, variant.label, f.product_id, quantity, unitPrice, unitPrice * quantity,
       name, phone, email, reception, reception === 'delivery' ? address : null, minutes, token]
    );
    await tx.query('COMMIT');
    res.status(201).json({ data: { ...rows[0], total_amount: Number(rows[0].total_amount), token } });
  } catch (err) {
    if (tx) await tx.query('ROLLBACK').catch(() => {});
    if (err.code === '22P02') return res.status(400).json({ error: 'Formule introuvable' });
    next(err);
  } finally {
    if (tx) tx.release();
  }
};

async function loadOrderByToken(token, q = db) {
  if (!token || token.length < 20) return null;
  const { rows } = await q.query(
    `SELECT fo.*, f.slug, f.title AS funnel_title, f.payment_methods, f.confirmation_message,
            f.image_url AS funnel_image, p.image_url AS product_image
       FROM app.funnel_orders fo
       JOIN app.funnels f ON f.id = fo.funnel_id
       JOIN app.products p ON p.id = fo.product_id
      WHERE fo.access_token = $1`,
    [token]
  );
  return rows[0] || null;
}

// Facture limitée à ce qu'il faut pour l'afficher (jamais de prix d'achat)
function publicInvoice(inv) {
  if (!inv) return null;
  return {
    invoice_number: inv.invoice_number,
    invoice_type: inv.invoice_type,
    status: inv.status,
    client: inv.client,
    items: (inv.items || []).map((it) => ({ name: it.name, sku: it.sku, quantity: it.quantity, unit_price: it.unit_price, total: it.total })),
    subtotal: inv.subtotal,
    discount: inv.discount,
    total_amount: inv.total_amount,
    acompte_amount: inv.acompte_amount,
    payment_method: inv.payment_method,
    notes: inv.notes,
    issued_at: inv.issued_at,
    order_status: inv.order_status || null,
    order_state: inv.order_state || null,
  };
}

// GET /api/funnels/orders/:token — page de suivi du client (statut, paiement, facture)
exports.getOrder = async (req, res, next) => {
  try {
    let fo = await loadOrderByToken(req.params.token);
    if (!fo) return res.status(404).json({ error: 'Commande introuvable' });
    if (fo.status === 'reserved' && new Date(fo.expires_at) <= new Date()) fo = { ...fo, status: 'expired' };

    const settings = await getPaymentSettings();
    const invoiceId = fo.invoice_id || fo.proforma_id;
    let invoice = null;
    if (invoiceId) {
      const r = await callHandler(invoicesController.getInvoice, { params: { id: invoiceId } });
      if (r.status === 200) invoice = publicInvoice(r.body.data);
    }

    res.json({
      data: {
        ref: fo.ref,
        status: fo.status,
        funnel: { slug: fo.slug, title: fo.funnel_title, image: fo.funnel_image || fo.product_image || null },
        variant: fo.variant_label,
        quantity: fo.quantity,
        unit_price: Number(fo.unit_price),
        total_amount: Number(fo.total_amount),
        customer_name: fo.customer_name,
        reception: fo.reception,
        reception_label: RECEPTION_LABELS[fo.reception],
        address: fo.address,
        payment_method: fo.payment_method,
        expires_at: fo.expires_at,
        cancel_reason: fo.status === 'cancelled' ? fo.cancel_reason : null,
        payment: publicPayment(settings, fo),
        confirmation_message: fo.confirmation_message || null,
        whatsapp: settings.team_whatsapp || null,
        invoice,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/funnels/orders/:token/declare { method } — « J'ai payé » ou paiement à la livraison
exports.declarePayment = async (req, res, next) => {
  let tx = null;
  try {
    const method = req.body?.method;
    tx = await db.connect();
    await tx.query('BEGIN');
    const { rows } = await tx.query('SELECT id FROM app.funnel_orders WHERE access_token = $1 FOR UPDATE', [req.params.token]);
    if (!rows[0]) {
      await tx.query('ROLLBACK');
      return res.status(404).json({ error: 'Commande introuvable' });
    }
    const fo = await loadOrderByToken(req.params.token, tx);
    const expired = fo.status === 'reserved' && new Date(fo.expires_at) <= new Date();
    if (expired || !['reserved', 'not_received'].includes(fo.status)) {
      await tx.query('ROLLBACK');
      return res.status(409).json({
        error: expired ? 'Le délai de réservation est dépassé. Recommandez depuis la page de l\'offre.' : 'Cette commande a déjà été transmise',
      });
    }
    const settings = await getPaymentSettings(tx);
    if (!enabledMethods(settings, fo).includes(method)) {
      await tx.query('ROLLBACK');
      return res.status(400).json({ error: 'Moyen de paiement indisponible' });
    }
    const maxCod = Number(settings.cod.max_amount) || 0;
    if (method === 'cod' && maxCod > 0 && Number(fo.total_amount) > maxCod) {
      await tx.query('ROLLBACK');
      return res.status(400).json({ error: 'Le paiement à la livraison n\'est pas possible pour ce montant' });
    }

    const status = method === 'cod' ? 'cod_pending' : 'declared';
    await tx.query(
      `UPDATE app.funnel_orders SET status = $1, payment_method = $2, declared_at = now(), updated_at = now() WHERE id = $3`,
      [status, method, fo.id]
    );
    await tx.query('COMMIT');
    tx.release();
    tx = null;

    // Facture « en attente » (proforma) : même numérotation que les autres factures,
    // remplacée par la facture définitive à la confirmation du paiement
    if (!fo.proforma_id) {
      try {
        const r = await callHandler(invoicesController.createProforma, {
          body: {
            client: { name: fo.customer_name, phone: fo.customer_phone, email: fo.customer_email, address: fo.address },
            items: [{ product_id: fo.product_id, quantity: fo.quantity, unit_price: Number(fo.unit_price) }],
            notes: `Promo « ${fo.funnel_title} » — ${fo.variant_label} — réf ${fo.ref} — ${METHOD_LABELS[method]}`,
          },
        });
        if (r.status === 201) {
          await db.query('UPDATE app.funnel_orders SET proforma_id = $1 WHERE id = $2', [r.body.data.id, fo.id]);
        } else {
          console.warn('[funnel] Proforma non créée :', r.body?.error);
        }
      } catch (e) {
        console.warn('[funnel] Proforma non créée :', e.message);
      }
    }

    // Nouvelle déclaration après « non reçu » : seule l'équipe est prévenue (pas de 2e mail au client)
    if (fo.status !== 'not_received') emitEvent('funnel.order_received', fo.id);
    emitEvent('funnel.payment_declared', fo.id);
    res.json({ data: { status } });
  } catch (err) {
    if (tx) await tx.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (tx) tx.release();
  }
};
