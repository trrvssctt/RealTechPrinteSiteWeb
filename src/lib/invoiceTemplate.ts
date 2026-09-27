// ─────────────────────────────────────────────────────────────────────────────
// Template unique des factures (définitive, acompte, proforma) — design calqué sur le modèle
// assets/Bon_Commande_BC-2026-0014-1.pdf (en-tête société, tableau bleu, total).
// Utilisé pour l'impression et la génération PDF depuis Commandes & Ventes.
// ─────────────────────────────────────────────────────────────────────────────

// Importé via Vite : URL valide en dev comme en build (le fichier n'est pas dans public/)
import logoUrl from '/assets/logo_realtech.png';

// Coordonnées de l'entreprise — à compléter (NINEA / RC) si disponibles
export const COMPANY = {
  name: 'RealTech Holding',
  addressLines: ['Ouakam Cité Avion', 'Dakar, Sénégal'],
  phone: '+221 77 422 03 20',
  email: 'sidydiop.boss@realtechprint.com',
  website: 'www.realtechprint.com',
  ninea: '', // ex: 'SN-DKR-...'
  rc: '',    // ex: 'SN-DKR-...'
  logoUrl,
};

export type InvoiceType = 'definitive' | 'acompte' | 'proforma';

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  definitive: 'Définitive',
  acompte: 'Acompte',
  proforma: 'Proforma',
};

const INVOICE_TITLES: Record<InvoiceType, string> = {
  definitive: 'FACTURE DÉFINITIVE',
  acompte: "FACTURE D'ACOMPTE",
  proforma: 'FACTURE PROFORMA',
};

// Facture telle que renvoyée par /api/admin/invoices (instantané figé à l'émission)
export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  status: 'issued' | 'converted' | 'cancelled';
  order_id: string | null;
  converted_order_id: string | null;
  client_id: string | null;
  client: { name?: string | null; phone?: string | null; email?: string | null };
  items: Array<{ product_id?: string | null; service_id?: string | null; name: string; sku?: string | null; quantity: number; unit_price: number; total: number }>;
  subtotal: number | string;
  discount: number | string;
  total_amount: number | string;
  acompte_amount: number | string | null;
  payment_method: string | null;
  notes: string | null;
  issued_at: string;
  created_by_name?: string | null;
  order_status?: string | null; // statut de la commande liée (cachet si terminée)
  // État de la commande figé à l'émission (factures définitive / acompte)
  order_state?: {
    order_status: string;
    delivery_status: 'full' | 'partial' | 'none';
    payment_status: 'paid' | 'partial' | 'unpaid';
    amount_paid: number;
    remaining: number;
    payments: Array<{ paid_at: string; method: string | null; amount: number }>;
  } | null;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

export const DELIVERY_LABELS: Record<string, string> = {
  full: 'Totalement livrée',
  partial: 'Partiellement livrée',
  none: 'Non livrée',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  card: 'Carte bancaire',
  transfer: 'Virement',
  wave: 'Wave / Orange Money',
};

export const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const fmtAmount = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n) || 0);

export const fmtDate = (d: string | Date | undefined): string => {
  try {
    return new Date(d || Date.now()).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return '';
  }
};

export const fmtShortDate = (d: string | Date | undefined): string => {
  try {
    return new Date(d || Date.now()).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
};

const sumRow = (label: string, value: string, cls = 'sum') => `
      <tr class="${cls}">
        <td></td><td class="sum-label">${label}</td><td></td><td></td><td></td>
        <td class="r">${value}</td>
      </tr>`;

// Styles communs aux documents RealTech (factures, rapports) — format A4
export const DOC_CSS = `  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1f2937; background: #fff; }
  .invoice-container { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm 15mm 22mm;
    display: flex; flex-direction: column; background: #fff; position: relative; }

  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  .head .co-name { color: #2f6fb2; font-size: 24px; font-weight: 700; margin-bottom: 8px; }
  .head .co-lines { font-size: 11.5px; color: #374151; line-height: 1.55; }
  .head img.logo { height: 52px; object-fit: contain; }
  .rule { border: none; border-top: 2px solid #2f6fb2; margin: 16px 0 22px; }

  h1.doc-title { text-align: center; font-size: 21px; letter-spacing: 1px; color: #111827; margin-bottom: 22px; }

  .meta { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px; }
  .meta .num { font-weight: 700; }
  .meta .date b { font-weight: 700; }
  .status { font-size: 11.5px; color: #374151; margin-bottom: 4px; }
  .status-gap { height: 16px; }
  .status b.paid { color: #047857; }
  .status b.unpaid { color: #b45309; }

  .section-band { background: #eceef1; padding: 6px 10px; font-size: 11.5px; font-weight: 700;
    letter-spacing: 0.5px; color: #374151; margin-bottom: 6px; }
  .client-name { font-size: 14px; font-weight: 700; margin: 4px 0 2px; }
  .client-sub { font-size: 11.5px; color: #4b5563; margin-bottom: 22px; line-height: 1.5; }

  table.items { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 6px; }
  table.items th { background: #4a86c8; color: #fff; font-weight: 700; padding: 8px 6px;
    border: 1px solid #3d74b0; }
  table.items td { padding: 8px 6px; border: 1px solid #d7dde5; vertical-align: top; }
  table.items tbody tr:nth-child(odd) { background: #f7f9fb; }
  td.c, th.c { text-align: center; }
  td.r, th.r { text-align: right; }
  td.code { font-size: 10.5px; color: #4b5563; }
  tr.sum td { border: 1px solid #d7dde5; background: #f1f4f8; font-size: 11.5px; padding: 7px 6px; }
  tr.sum .sum-label { font-weight: 700; text-align: right; }
  tr.total td { background: #e6eaf0; font-weight: 700; font-size: 12.5px; padding: 9px 6px;
    border: 1px solid #c9d2dd; }
  tr.total .sum-label { text-align: right; }

  .payment { font-size: 12px; margin-top: 14px; }
  .notes { font-size: 11.5px; color: #4b5563; margin-top: 6px; font-style: italic; }

  .sign { margin-top: 40px; font-size: 11.5px; font-style: italic; color: #374151; }
  .sign .line { margin-top: 46px; border-top: 1px solid #9ca3af; width: 220px; }

  .invoice-footer { margin-top: auto; padding-top: 28px; text-align: center; font-size: 10px;
    color: #9ca3af; font-style: italic; }

  @page { size: A4; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

// En-tête société (nom, coordonnées, logo) suivi du filet bleu
export function companyHeaderHTML(): string {
  const companyLines = [
    ...COMPANY.addressLines,
    `Tél : ${COMPANY.phone}`,
    `Email : ${COMPANY.email}`,
    COMPANY.website,
    COMPANY.ninea ? `NINEA : ${COMPANY.ninea}` : null,
    COMPANY.rc ? `RC : ${COMPANY.rc}` : null,
  ].filter(Boolean).map(l => `<div>${esc(l)}</div>`).join('');
  return `
    <div class="head">
      <div>
        <div class="co-name">${esc(COMPANY.name)}</div>
        <div class="co-lines">${companyLines}</div>
      </div>
      <img class="logo" src="${COMPANY.logoUrl}" alt="${esc(COMPANY.name)}" />
    </div>
    <hr class="rule" />`;
}

export function buildInvoiceHTML(invoice: Invoice): string {
  const type: InvoiceType = invoice.invoice_type;
  const docTitle = INVOICE_TITLES[type] || 'FACTURE';
  const number = invoice.invoice_number;
  const date = fmtDate(invoice.issued_at);

  const clientName = invoice.client?.name || 'Client';
  const clientPhone = invoice.client?.phone || '';
  const clientEmail = invoice.client?.email || '';

  const items = invoice.items || [];
  const itemsSum = Number(invoice.subtotal) || items.reduce((s, it) => s + Number(it.total || 0), 0);
  const discount = Number(invoice.discount || 0);
  const total = Number(invoice.total_amount) || 0;

  const paymentLabel = invoice.payment_method ? (PAYMENT_LABELS[invoice.payment_method] || invoice.payment_method) : null;
  const notes = invoice.notes;

  const rowsHtml = items.map((it, i) => {
    const name = it.name || 'Article';
    const code = it.sku || '—';
    const qty = Number(it.quantity || 0);
    const pu = Number(it.unit_price || 0);
    const lineTotal = Number(it.total) || pu * qty;
    return `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${esc(name)}</td>
        <td class="c code">${esc(code)}</td>
        <td class="c">${qty}</td>
        <td class="r">${fmtAmount(pu)}</td>
        <td class="r">${fmtAmount(lineTotal)}</td>
      </tr>`;
  }).join('');

  const discountRows = discount > 0
    ? sumRow('SOUS-TOTAL', `${fmtAmount(itemsSum)} FCFA`) + sumRow('REMISE', `− ${fmtAmount(discount)} FCFA`)
    : '';

  // Après le TOTAL : versements reçus, total payé et reste à payer (état de la commande)
  const state = type !== 'proforma' ? invoice.order_state : null;
  let paymentRows = '';
  if (state) {
    for (const p of state.payments || []) {
      const mode = p.method ? ` (${PAYMENT_LABELS[p.method] || p.method})` : '';
      paymentRows += sumRow(`VERSEMENT DU ${esc(fmtShortDate(p.paid_at))}${esc(mode)}`, `${fmtAmount(p.amount)} FCFA`);
    }
    paymentRows += sumRow('TOTAL PAYÉ', `${fmtAmount(state.amount_paid)} FCFA`);
    paymentRows += sumRow('RESTE À PAYER', `${fmtAmount(state.remaining)} FCFA`, 'total');
  } else if (type === 'acompte' && invoice.acompte_amount != null) {
    paymentRows += sumRow('MONTANT DE L\'ACOMPTE', `${fmtAmount(Number(invoice.acompte_amount))} FCFA`, 'total');
  }
  const paymentLabelText = state
    ? (state.payment_status === 'paid' ? 'PAYÉE' : 'NON PAYÉE')
    : null;
  const stateLine = state ? `
    <div class="status">
      Commande : <b>${esc(ORDER_STATUS_LABELS[state.order_status] || state.order_status)}</b>
      — Livraison : <b>${esc(DELIVERY_LABELS[state.delivery_status] || state.delivery_status)}</b>
      — Paiement : <b class="${state.payment_status === 'paid' ? 'paid' : 'unpaid'}">${paymentLabelText}</b>
    </div>` : '';

  // Mode de paiement unique : seulement si la liste des versements (avec leur mode) n'est pas affichée
  const paymentBlock = (type !== 'proforma' && paymentLabel && !state) ? `
    <div class="payment">Mode de paiement : <strong>${esc(paymentLabel)}</strong></div>` : '';
  const notesBlock = notes ? `<div class="notes">Note : ${esc(notes)}</div>` : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${docTitle} ${esc(number)}</title>
<style>
${DOC_CSS}
</style>
</head>
<body>
  <div class="invoice-container">
    ${companyHeaderHTML()}

    <h1 class="doc-title">${docTitle}</h1>

    <div class="meta">
      <div class="num">N° ${esc(number)}</div>
      <div class="date">Date : <b>${esc(date)}</b></div>
    </div>
    <div class="status">Type : ${esc(INVOICE_TYPE_LABELS[type] || type)}${invoice.status === 'cancelled' ? ' — <b>ANNULÉE</b>' : ''}</div>
    ${stateLine}
    <div class="status-gap"></div>

    <div class="section-band">CLIENT</div>
    <div class="client-name">${esc(clientName)}</div>
    <div class="client-sub">
      ${clientPhone ? `Tél : ${esc(clientPhone)}` : ''}
      ${clientPhone && clientEmail ? ' — ' : ''}
      ${clientEmail ? `Email : ${esc(clientEmail)}` : ''}
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="c" style="width:6%">N°</th>
          <th style="width:39%">Désignation</th>
          <th class="c" style="width:15%">Code</th>
          <th class="c" style="width:8%">Qté</th>
          <th class="r" style="width:15%">P.U. (FCFA)</th>
          <th class="r" style="width:17%">Total (FCFA)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        ${discountRows}
        ${sumRow('TOTAL', `${fmtAmount(total)} FCFA`, 'total')}
        ${paymentRows}
      </tbody>
    </table>

    ${paymentBlock}
    ${notesBlock}

    <div class="sign">
      Signature et cachet :
      <div class="line"></div>
    </div>

    <div class="invoice-footer">
      ${esc(COMPANY.name)} — Document généré le ${new Date().toLocaleString('fr-FR')}
    </div>
  </div>
</body>
</html>`;
}
