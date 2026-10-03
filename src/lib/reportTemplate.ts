// ─────────────────────────────────────────────────────────────────────────────
// Rapport d'activité en PDF — même mise en page que les factures
// (en-tête société, bandeaux, tableaux bleus, lignes de total).
// Données : réponse `report_data` de /api/admin/rapports.
// ─────────────────────────────────────────────────────────────────────────────

import { COMPANY, DOC_CSS, ORDER_STATUS_LABELS, companyHeaderHTML, esc, fmtAmount } from '@/lib/invoiceTemplate';

export interface ReportData {
  periodLabel: string;
  sources: { ventes?: boolean; stock?: boolean; depenses?: boolean };
  ventes: Array<{
    id: string; placed_at: string; status: string; total_amount: number | string;
    montant_produits?: number | string; montant_services?: number | string;
    client: string | null; employe: string | null;
    lignes: Array<{ produit: string; qte: number; pu: number | string; total: number | string }>;
  }>;
  sorties: Array<{ created_at: string; quantity: number; type_sortie: string | null; reference: string | null; produit: string | null; employe: string | null }>;
  depenses: Array<{ created_at: string; description: string; montant: number | string; categorie: string | null; statut: string | null; employe: string | null }>;
}

const REPORT_TITLES: Record<string, string> = {
  journalier: 'RAPPORT JOURNALIER',
  mensuelle: 'RAPPORT MENSUEL',
  annuelle: 'RAPPORT ANNUEL',
  personnalise: 'RAPPORT PERSONNALISÉ',
};

const fmtDateTime = (d: string) => {
  try {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const totalRow = (label: string, value: string, colspan: number) => `
      <tr class="total">
        <td colspan="${colspan}" class="sum-label">${label}</td>
        <td class="r">${value}</td>
      </tr>`;

export function buildReportHTML(
  data: ReportData,
  opts: { type: string; generatedBy?: string | null; generatedAt?: string | Date } = { type: 'personnalise' },
): string {
  const src = data.sources || {};
  const showVentes = src.ventes !== false;
  const showStock = src.stock !== false;
  const showDepenses = src.depenses !== false;

  // Les ventes annulées sont listées mais exclues du chiffre d'affaires
  const ventesActives = data.ventes.filter(v => v.status !== 'cancelled');
  const ca = ventesActives.reduce((s, v) => s + Number(v.total_amount || 0), 0);
  const caServices = ventesActives.reduce((s, v) => s + Number(v.montant_services || 0), 0);
  const caProduits = ca - caServices;
  const qteSortie = data.sorties.reduce((s, m) => s + Number(m.quantity || 0), 0);
  const totalDepenses = data.depenses.reduce((s, d) => s + Number(d.montant || 0), 0);

  const kpis: string[] = [];
  if (showVentes) {
    kpis.push(`<div class="kpi"><div class="l">CA Produits</div><div class="v">${fmtAmount(caProduits)} FCFA</div></div>`);
    kpis.push(`<div class="kpi"><div class="l">CA Services</div><div class="v">${fmtAmount(caServices)} FCFA</div></div>`);
    kpis.push(`<div class="kpi"><div class="l">CA Total (produits + services)</div><div class="v">${fmtAmount(ca)} FCFA</div><div class="s">${ventesActives.length} vente(s)</div></div>`);
  }
  if (showStock) {
    kpis.push(`<div class="kpi"><div class="l">Sorties de stock</div><div class="v">${fmtAmount(qteSortie)}</div><div class="s">${data.sorties.length} mouvement(s)</div></div>`);
  }
  if (showDepenses) {
    kpis.push(`<div class="kpi"><div class="l">Dépenses</div><div class="v neg">${fmtAmount(totalDepenses)} FCFA</div><div class="s">${data.depenses.length} dépense(s)</div></div>`);
  }
  if (showVentes && showDepenses) {
    const net = ca - totalDepenses;
    kpis.push(`<div class="kpi"><div class="l">Résultat (CA − dépenses)</div><div class="v ${net < 0 ? 'neg' : ''}">${net < 0 ? '− ' : ''}${fmtAmount(Math.abs(net))} FCFA</div></div>`);
  }

  const ventesSection = !showVentes ? '' : `
    <div class="section-band">VENTES</div>
    ${data.ventes.length === 0 ? '<p class="empty">Aucune vente sur la période.</p>' : `
    <table class="items">
      <thead>
        <tr>
          <th class="c" style="width:5%">N°</th>
          <th style="width:18%">Date</th>
          <th style="width:14%">Client</th>
          <th style="width:23%">Articles</th>
          <th class="c" style="width:10%">Statut</th>
          <th class="r" style="width:10%">Produits</th>
          <th class="r" style="width:10%">Services</th>
          <th class="r" style="width:12%">Montant (FCFA)</th>
        </tr>
      </thead>
      <tbody>
        ${data.ventes.map((v, i) => {
          const cancelled = v.status === 'cancelled';
          const articles = (v.lignes || []).map(l => `${esc(l.produit)} ×${l.qte}`).join('<br/>') || '—';
          return `
        <tr class="${cancelled ? 'cancelled' : ''}">
          <td class="c">${i + 1}</td>
          <td class="nowrap">${esc(fmtDateTime(v.placed_at))}</td>
          <td>${esc(v.client || '—')}</td>
          <td>${articles}</td>
          <td class="c">${esc(ORDER_STATUS_LABELS[v.status] || v.status)}</td>
          <td class="r">${fmtAmount(Number(v.montant_produits ?? v.total_amount ?? 0))}</td>
          <td class="r">${fmtAmount(Number(v.montant_services || 0))}</td>
          <td class="r">${fmtAmount(Number(v.total_amount || 0))}</td>
        </tr>`;
        }).join('')}
        ${totalRow('Dont produits', `${fmtAmount(caProduits)} FCFA`, 7)}
        ${totalRow('Dont services', `${fmtAmount(caServices)} FCFA`, 7)}
        ${totalRow('TOTAL (hors ventes annulées)', `${fmtAmount(ca)} FCFA`, 7)}
      </tbody>
    </table>`}`;

  const stockSection = !showStock ? '' : `
    <div class="section-band">SORTIES DE STOCK</div>
    ${data.sorties.length === 0 ? '<p class="empty">Aucune sortie de stock sur la période.</p>' : `
    <table class="items">
      <thead>
        <tr>
          <th class="c" style="width:5%">N°</th>
          <th style="width:16%">Date</th>
          <th style="width:31%">Produit</th>
          <th class="c" style="width:14%">Motif</th>
          <th style="width:22%">Employé</th>
          <th class="c" style="width:12%">Quantité</th>
        </tr>
      </thead>
      <tbody>
        ${data.sorties.map((m, i) => `
        <tr>
          <td class="c">${i + 1}</td>
          <td class="nowrap">${esc(fmtDateTime(m.created_at))}</td>
          <td>${esc(m.produit || '—')}</td>
          <td class="c">${esc(m.type_sortie || '—')}</td>
          <td>${esc(m.employe || '—')}</td>
          <td class="c">${fmtAmount(Number(m.quantity || 0))}</td>
        </tr>`).join('')}
        ${totalRow('TOTAL', fmtAmount(qteSortie), 5)}
      </tbody>
    </table>`}`;

  const depensesSection = !showDepenses ? '' : `
    <div class="section-band">DÉPENSES</div>
    ${data.depenses.length === 0 ? '<p class="empty">Aucune dépense sur la période.</p>' : `
    <table class="items">
      <thead>
        <tr>
          <th class="c" style="width:5%">N°</th>
          <th style="width:16%">Date</th>
          <th style="width:33%">Description</th>
          <th style="width:16%">Catégorie</th>
          <th class="c" style="width:13%">Statut</th>
          <th class="r" style="width:17%">Montant (FCFA)</th>
        </tr>
      </thead>
      <tbody>
        ${data.depenses.map((d, i) => `
        <tr>
          <td class="c">${i + 1}</td>
          <td class="nowrap">${esc(fmtDateTime(d.created_at))}</td>
          <td>${esc(d.description || '—')}</td>
          <td>${esc(d.categorie || '—')}</td>
          <td class="c">${esc(d.statut || '—')}</td>
          <td class="r">${fmtAmount(Number(d.montant || 0))}</td>
        </tr>`).join('')}
        ${totalRow('TOTAL', `${fmtAmount(totalDepenses)} FCFA`, 5)}
      </tbody>
    </table>`}`;

  const title = REPORT_TITLES[opts.type] || 'RAPPORT';
  const generatedAt = new Date(opts.generatedAt || Date.now()).toLocaleString('fr-FR');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${title} — ${esc(data.periodLabel)}</title>
<style>
${DOC_CSS}
  .kpis { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
  .kpi { flex: 1 1 30%; border: 1px solid #d7dde5; background: #f7f9fb; padding: 9px 10px; }
  .kpi .l { font-size: 9.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
  .kpi .v { font-size: 14px; font-weight: 700; color: #2f6fb2; margin-top: 3px; }
  .kpi .v.neg { color: #b91c1c; }
  .kpi .s { font-size: 10px; color: #6b7280; margin-top: 2px; }
  table.items { margin-bottom: 22px; }
  td.nowrap { white-space: nowrap; }
  tr.cancelled td { color: #9ca3af; }
  tr.cancelled td.r { text-decoration: line-through; }
  .empty { font-size: 11.5px; color: #6b7280; font-style: italic; margin: 4px 0 22px; }
</style>
</head>
<body>
  <div class="invoice-container">
    ${companyHeaderHTML()}

    <h1 class="doc-title">${title}</h1>

    <div class="meta">
      <div class="num">Période : ${esc(data.periodLabel)}</div>
      <div class="date">Généré le : <b>${esc(generatedAt)}</b></div>
    </div>
    <div class="status">${opts.generatedBy ? `Établi par : ${esc(opts.generatedBy)}` : '&nbsp;'}</div>
    <div class="status-gap"></div>

    <div class="section-band">SYNTHÈSE</div>
    <div class="kpis avoid-break">${kpis.join('')}</div>

    ${ventesSection}
    ${stockSection}
    ${depensesSection}

    <div class="invoice-footer">
      ${esc(COMPANY.name)} — Rapport généré le ${esc(generatedAt)}
    </div>
  </div>
</body>
</html>`;
}
