/**
 * Service de rapport journalier
 * Génère un fichier Excel avec 3 feuilles (Ventes, Sorties Stock, Dépenses)
 * et l'envoie via WhatsApp à 22h00 (via n8n).
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const n8n = require('./n8nWebhookService');

// ─── Requêtes base de données ───────────────────────────────────────────────

async function getVentesJour(date) {
  const { rows } = await pool.query(`
    SELECT
      o.id,
      o.placed_at,
      o.status,
      o.total_amount,
      c.full_name   AS client,
      u.full_name   AS employe,
      COALESCE(
        json_agg(
          json_build_object(
            'produit',    COALESCE(oi.product_name, oi.service_name, '—'),
            'qte',        oi.quantity,
            'pu',         oi.unit_price,
            'total',      oi.total
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS lignes
    FROM app.orders o
    LEFT JOIN app.clients  c  ON c.id = o.client_id
    LEFT JOIN app.users    u  ON u.id = o.created_by
    LEFT JOIN app.order_items oi ON oi.order_id = o.id
    WHERE o.placed_at::date = $1
    GROUP BY o.id, c.full_name, u.full_name
    ORDER BY o.placed_at
  `, [date]);
  return rows;
}

async function getSortiesStock(date) {
  const { rows } = await pool.query(`
    SELECT
      sm.created_at,
      p.name          AS produit,
      sm.quantity,
      sm.movement_subtype AS type_sortie,
      sm.reference,
      sm.status,
      u.full_name     AS employe
    FROM app.stock_mouvement sm
    LEFT JOIN app.products p ON p.id = sm.product_id
    LEFT JOIN app.users    u ON u.id = sm.created_by
    WHERE sm.movement_type = 'out'
      AND sm.created_at::date = $1
    ORDER BY sm.created_at
  `, [date]);
  return rows;
}

async function getDepenses(date) {
  const { rows } = await pool.query(`
    SELECT
      d.created_at,
      d.description,
      d.montant,
      d.categorie,
      u.full_name AS employe
    FROM app.depenses d
    LEFT JOIN app.users u ON u.id = d.created_by
    WHERE d.created_at::date = $1
    ORDER BY d.created_at
  `, [date]);
  return rows;
}

// ─── Style commun ──────────────────────────────────────────────────────────────

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
const ALT_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
const TOTAL_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } };

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF1E3A5F' } },
    };
  });
  row.height = 28;
}

function styleDataRow(row, index) {
  if (index % 2 === 0) {
    row.eachCell((cell) => { cell.fill = ALT_FILL; });
  }
  row.eachCell((cell) => {
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.font = { name: 'Calibri', size: 10 };
  });
  row.height = 20;
}

function addTitleRow(sheet, title, colCount) {
  const titleRow = sheet.insertRow(1, [title]);
  sheet.mergeCells(1, 1, 1, colCount);
  const cell = titleRow.getCell(1);
  cell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' }, name: 'Calibri' };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
  titleRow.height = 36;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtMontant(v) {
  return v !== null && v !== undefined ? parseFloat(v).toFixed(2) : '—';
}

// ─── Construction du classeur Excel ───────────────────────────────────────────

async function buildWorkbook(date, ventes, sorties, depenses) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RealTech Print';
  wb.created = new Date();

  const dateLabel = new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── Feuille 1 : Ventes ────────────────────────────────────────────────────
  const wsVentes = wb.addWorksheet('Ventes', { tabColor: { argb: 'FF1E8449' } });

  wsVentes.columns = [
    { header: 'Heure',         key: 'heure',   width: 10 },
    { header: 'N° Commande',   key: 'id',      width: 38 },
    { header: 'Client',        key: 'client',  width: 22 },
    { header: 'Employé',       key: 'employe', width: 22 },
    { header: 'Produits / Services', key: 'lignes', width: 40 },
    { header: 'Statut',        key: 'status',  width: 14 },
    { header: 'Montant (FCFA)', key: 'montant', width: 16 },
  ];

  styleHeader(wsVentes.getRow(1));

  let totalVentes = 0;
  ventes.forEach((v, i) => {
    const lignesTxt = (v.lignes || [])
      .map(l => `${l.produit} ×${l.qte} = ${fmtMontant(l.total)} FCFA`)
      .join('\n');
    const row = wsVentes.addRow({
      heure:   fmtDate(v.placed_at),
      id:      v.id,
      client:  v.client || '—',
      employe: v.employe || '—',
      lignes:  lignesTxt || '—',
      status:  v.status,
      montant: parseFloat(v.total_amount || 0),
    });
    wsVentes.getRow(row.number).getCell('montant').numFmt = '#,##0.00';
    styleDataRow(row, i);
    totalVentes += parseFloat(v.total_amount || 0);
  });

  // Ligne total
  const totalRowV = wsVentes.addRow({
    heure: '', id: '', client: '', employe: '', lignes: '',
    status: 'TOTAL', montant: totalVentes,
  });
  totalRowV.eachCell(c => { c.fill = TOTAL_FILL; c.font = { bold: true, name: 'Calibri' }; });
  totalRowV.getCell('montant').numFmt = '#,##0.00';

  addTitleRow(wsVentes, `Ventes du ${dateLabel}`, 7);

  // ── Feuille 2 : Sorties de stock ──────────────────────────────────────────
  const wsSorties = wb.addWorksheet('Sorties Stock', { tabColor: { argb: 'FFE67E22' } });

  wsSorties.columns = [
    { header: 'Heure',          key: 'heure',       width: 10 },
    { header: 'Produit',        key: 'produit',     width: 28 },
    { header: 'Quantité',       key: 'quantite',    width: 12 },
    { header: 'Type de sortie', key: 'type_sortie', width: 20 },
    { header: 'Référence',      key: 'reference',   width: 22 },
    { header: 'Statut',         key: 'status',      width: 12 },
    { header: 'Employé',        key: 'employe',     width: 22 },
  ];

  styleHeader(wsSorties.getRow(1));

  let totalQteSorties = 0;
  sorties.forEach((s, i) => {
    const row = wsSorties.addRow({
      heure:       fmtDate(s.created_at),
      produit:     s.produit || '—',
      quantite:    s.quantity,
      type_sortie: s.type_sortie || '—',
      reference:   s.reference || '—',
      status:      s.status,
      employe:     s.employe || '—',
    });
    styleDataRow(row, i);
    totalQteSorties += parseInt(s.quantity || 0);
  });

  const totalRowS = wsSorties.addRow({
    heure: '', produit: '', quantite: totalQteSorties,
    type_sortie: '', reference: '', status: 'TOTAL', employe: '',
  });
  totalRowS.eachCell(c => { c.fill = TOTAL_FILL; c.font = { bold: true, name: 'Calibri' }; });

  addTitleRow(wsSorties, `Sorties de Stock du ${dateLabel}`, 7);

  // ── Feuille 3 : Dépenses ──────────────────────────────────────────────────
  const wsDepenses = wb.addWorksheet('Dépenses', { tabColor: { argb: 'FFC0392B' } });

  wsDepenses.columns = [
    { header: 'Heure',         key: 'heure',       width: 10 },
    { header: 'Description',   key: 'description', width: 35 },
    { header: 'Catégorie',     key: 'categorie',   width: 20 },
    { header: 'Montant (FCFA)', key: 'montant',    width: 16 },
    { header: 'Employé',       key: 'employe',     width: 22 },
  ];

  styleHeader(wsDepenses.getRow(1));

  let totalDepenses = 0;
  depenses.forEach((d, i) => {
    const row = wsDepenses.addRow({
      heure:       fmtDate(d.created_at),
      description: d.description,
      categorie:   d.categorie || '—',
      montant:     parseFloat(d.montant || 0),
      employe:     d.employe || '—',
    });
    wsDepenses.getRow(row.number).getCell('montant').numFmt = '#,##0.00';
    styleDataRow(row, i);
    totalDepenses += parseFloat(d.montant || 0);
  });

  const totalRowD = wsDepenses.addRow({
    heure: '', description: '', categorie: 'TOTAL', montant: totalDepenses, employe: '',
  });
  totalRowD.eachCell(c => { c.fill = TOTAL_FILL; c.font = { bold: true, name: 'Calibri' }; });
  totalRowD.getCell('montant').numFmt = '#,##0.00';

  addTitleRow(wsDepenses, `Dépenses du ${dateLabel}`, 5);

  return { wb, totalVentes, totalQteSorties, totalDepenses, dateLabel };
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

async function generateAndSendDailyReport(targetDate) {
  const date = targetDate || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  console.log(`[DailyReport] Génération du rapport pour ${date}…`);

  const [ventes, sorties, depenses] = await Promise.all([
    getVentesJour(date),
    getSortiesStock(date),
    getDepenses(date),
  ]);

  const { wb, totalVentes, totalQteSorties, totalDepenses, dateLabel } =
    await buildWorkbook(date, ventes, sorties, depenses);

  // Sauvegarder le fichier temporairement
  const exportsDir = path.join(__dirname, '../../exports');
  if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

  const filename = `rapport_journalier_${date}.xlsx`;
  const filepath = path.join(exportsDir, filename);
  await wb.xlsx.writeFile(filepath);

  console.log(`[DailyReport] Fichier généré : ${filepath}`);

  // Sauvegarder dans app.rapports pour l'historique (ignore les doublons)
  try {
    await pool.query(
      `INSERT INTO app.rapports (user_id, type_rapport, format_rapport, parameters, filename, rows_count, metadata)
       VALUES ($1, 'journalier', 'xlsx', $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [
        null,
        JSON.stringify({ start: date, end: date }),
        filename,
        ventes.length + sorties.length + depenses.length,
        JSON.stringify({
          generated_via: 'daily_report_service',
          ventes_count: ventes.length,
          sorties_count: sorties.length,
          depenses_count: depenses.length,
          total_ventes: totalVentes,
          total_depenses: totalDepenses,
        }),
      ]
    );
  } catch (dbErr) {
    console.warn('[DailyReport] Impossible de sauvegarder dans app.rapports :', dbErr.message);
  }

  // Envoi via n8n → WhatsApp
  await n8n.notifyDailyReport({
    date,
    filepath,
    filename,
    totalVentes,
    totalQteSorties,
    totalDepenses,
    ventesCount:   ventes.length,
    depensesCount: depenses.length,
  });

  console.log(`[DailyReport] Rapport envoyé à n8n pour diffusion WhatsApp`);
  return { ok: true, filepath, whatsappSent: true };
}

module.exports = { generateAndSendDailyReport };
