// ─────────────────────────────────────────────────────────────────────────────
// Funnels promo : logique partagée entre l'API publique et l'API admin
// (réglages de paiement, stock promo disponible, état d'un funnel, événements n8n).
// ─────────────────────────────────────────────────────────────────────────────
const db = require('../config/db');
const n8n = require('./n8nWebhookService');

const SETTINGS_KEY = 'funnel_payment';
const METHODS = ['wave', 'orange_money', 'cod'];

const DEFAULT_SETTINGS = {
  wave: { enabled: true, number: '', holder: 'RealTech Holding' },
  orange_money: { enabled: true, number: '', holder: 'RealTech Holding' },
  cod: { enabled: true, zones: 'Dakar', max_amount: 300000 },
  reservation_minutes: 30,
  team_email: '',
  team_whatsapp: '',
};

const METHOD_LABELS = { wave: 'Wave', orange_money: 'Orange Money', cod: 'Paiement à la livraison' };
const RECEPTION_LABELS = { delivery: 'Livraison', pickup: "Retrait à l'atelier" };
const STATUS_LABELS = {
  reserved: 'Réservée',
  declared: 'Paiement déclaré',
  cod_pending: 'À livrer et encaisser',
  not_received: 'Paiement non reçu',
  confirming: 'Confirmation en cours',
  paid: 'Payée',
  cancelled: 'Annulée',
  expired: 'Réservation expirée',
};

// Commandes qui bloquent du stock promo (une réservation expirée ne bloque plus rien)
const HOLDING_SQL = (alias = 'fo') =>
  `(${alias}.status IN ('declared', 'cod_pending', 'not_received', 'confirming', 'paid')
    OR (${alias}.status = 'reserved' AND ${alias}.expires_at > now()))`;

async function getPaymentSettings(q = db) {
  const { rows } = await q.query('SELECT value FROM app.settings WHERE key = $1', [SETTINGS_KEY]);
  const v = rows[0]?.value || {};
  return {
    ...DEFAULT_SETTINGS,
    ...v,
    wave: { ...DEFAULT_SETTINGS.wave, ...(v.wave || {}) },
    orange_money: { ...DEFAULT_SETTINGS.orange_money, ...(v.orange_money || {}) },
    cod: { ...DEFAULT_SETTINGS.cod, ...(v.cod || {}) },
  };
}

// Moyens proposés pour un funnel : actifs dans les réglages, autorisés par le funnel,
// et pour Wave / Orange Money, un numéro renseigné
function enabledMethods(settings, funnel) {
  return METHODS.filter((m) => {
    if (!settings[m]?.enabled) return false;
    if (funnel.payment_methods && funnel.payment_methods[m] === false) return false;
    if (m !== 'cod' && !String(settings[m].number || '').trim()) return false;
    return true;
  });
}

// 'draft' | 'scheduled' | 'online' | 'ended'
function funnelState(f, now = new Date()) {
  if (!f.is_published) return 'draft';
  if (f.starts_at && now < new Date(f.starts_at)) return 'scheduled';
  if (f.ends_at && now > new Date(f.ends_at)) return 'ended';
  return 'online';
}

async function variantsWithAvailability(funnelId, q = db, { activeOnly = false } = {}) {
  const { rows } = await q.query(
    `SELECT v.*,
            COALESCE((SELECT SUM(fo.quantity) FROM app.funnel_orders fo
                       WHERE fo.variant_id = v.id AND ${HOLDING_SQL('fo')}), 0)::int AS held
       FROM app.funnel_variants v
      WHERE v.funnel_id = $1 ${activeOnly ? 'AND v.is_active' : ''}
      ORDER BY v.position, v.price`,
    [funnelId]
  );
  return rows.map((v) => ({
    ...v,
    price: Number(v.price),
    available: Math.max(0, Number(v.stock) - Number(v.held)),
  }));
}

function siteUrl() {
  const raw = process.env.PUBLIC_SITE_URL || (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || '').split(',')[0];
  return (raw || 'https://realtechprint.com').trim().replace(/\/$/, '');
}

const fmtF = (n) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n) || 0).replace(/ | /g, ' ')} F`;

// Appelle un contrôleur Express existant en interne (même validation, mêmes effets)
// et renvoie { status, body } ; une erreur passée à next() est rejetée.
function callHandler(handler, { body = {}, params = {}, query = {}, user = null } = {}) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const res = {
      status(code) { statusCode = code; return res; },
      json(payload) { resolve({ status: statusCode, body: payload }); return res; },
    };
    Promise.resolve(handler({ body, params, query, user, headers: {} }, res, reject)).catch(reject);
  });
}

// Données envoyées à n8n pour chaque événement (le workflow choisit destinataires et contenu)
async function buildEventPayload(eventType, funnelOrderId, extra = {}) {
  const { rows } = await db.query(
    `SELECT fo.*, f.title AS funnel_title, f.slug AS funnel_slug,
            inv.invoice_number AS invoice_number, inv.invoice_type AS invoice_type,
            pro.invoice_number AS proforma_number
       FROM app.funnel_orders fo
       JOIN app.funnels f ON f.id = fo.funnel_id
       LEFT JOIN app.invoices inv ON inv.id = fo.invoice_id
       LEFT JOIN app.invoices pro ON pro.id = fo.proforma_id
      WHERE fo.id = $1`,
    [funnelOrderId]
  );
  const fo = rows[0];
  if (!fo) return null;
  const settings = await getPaymentSettings();
  const base = siteUrl();
  const method = fo.payment_method;
  const transfer = method === 'wave' || method === 'orange_money';
  const total = Number(fo.total_amount);

  const message = [
    `🛍️ *Funnel promo* — ${fo.funnel_title}`,
    `📌 ${STATUS_LABELS[fo.status] || fo.status} · réf ${fo.ref}`,
    `👤 ${fo.customer_name} · ${fo.customer_phone}`,
    `📦 ${fo.variant_label} × ${fo.quantity}`,
    `💰 ${fmtF(total)}${method ? ` · ${METHOD_LABELS[method]}` : ''}`,
  ].join('\n');

  return {
    event_type: eventType,
    event_id: fo.id,
    ref: fo.ref,
    occurred_at: new Date().toISOString(),
    client: { name: fo.customer_name, phone: fo.customer_phone, email: fo.customer_email || null },
    funnel: { title: fo.funnel_title, slug: fo.funnel_slug, url: `${base}/promo/${fo.funnel_slug}` },
    order: {
      status: fo.status,
      status_label: STATUS_LABELS[fo.status] || fo.status,
      variant: fo.variant_label,
      quantity: fo.quantity,
      unit_price: Number(fo.unit_price),
      total,
      total_formatted: fmtF(total),
      reception: fo.reception,
      reception_label: RECEPTION_LABELS[fo.reception],
      address: fo.address || null,
      payment_method: method || null,
      payment_method_label: method ? METHOD_LABELS[method] : null,
    },
    payment: transfer
      ? { number: settings[method].number, holder: settings[method].holder, motif: fo.ref }
      : null,
    reservation_expires_at: fo.status === 'reserved' ? fo.expires_at : null,
    invoice: fo.invoice_number
      ? { number: fo.invoice_number, type: fo.invoice_type }
      : fo.proforma_number ? { number: fo.proforma_number, type: 'proforma' } : null,
    links: { order_page: `${base}/promo/commande/${fo.access_token}`, funnel_page: `${base}/promo/${fo.funnel_slug}` },
    reason: fo.cancel_reason || null,
    team: { email: settings.team_email || null, whatsapp: settings.team_whatsapp || null },
    message,
    ...extra,
  };
}

// Fire-and-forget : un échec n8n ne bloque jamais le parcours (il est journalisé)
function emitEvent(eventType, funnelOrderId, extra) {
  setImmediate(async () => {
    try {
      const payload = await buildEventPayload(eventType, funnelOrderId, extra);
      if (payload) await n8n.notifyFunnel(payload);
    } catch (e) {
      console.warn(`[funnel] Événement ${eventType} non envoyé :`, e.message);
    }
  });
}

// Réservations non payées dont le délai est dépassé : stock libéré + mail de relance
async function expireReservations() {
  const { rows } = await db.query(
    `UPDATE app.funnel_orders SET status = 'expired', updated_at = now()
      WHERE status = 'reserved' AND expires_at <= now()
      RETURNING id`
  );
  rows.forEach((r) => emitEvent('funnel.reservation_expired', r.id));
  return rows.length;
}

module.exports = {
  METHODS,
  METHOD_LABELS,
  RECEPTION_LABELS,
  STATUS_LABELS,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  HOLDING_SQL,
  getPaymentSettings,
  enabledMethods,
  funnelState,
  variantsWithAvailability,
  callHandler,
  emitEvent,
  expireReservations,
  siteUrl,
};
