const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const { randomUUID: uuidv4 } = require('crypto');

const EXPORTS_DIR = path.join(__dirname, '..', '..', 'exports');

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureExportsDir() {
  try { fs.mkdirSync(EXPORTS_DIR, { recursive: true }); } catch (_) {}
}

// Date range helpers
function buildDateRange(start, end) {
  const s = start ? new Date(start) : null;
  const e = end   ? new Date(end)   : null;
  // If only a date string (no time), extend end to end-of-day
  if (e && end && !end.includes('T')) {
    e.setHours(23, 59, 59, 999);
  }
  return { s, e };
}

// ── DB queries ────────────────────────────────────────────────────────────────

async function queryVentes(start, end) {
  const params = [];
  let where = 'WHERE 1=1';
  let idx = 1;
  if (start) { where += ` AND o.placed_at >= $${idx++}`; params.push(start); }
  if (end)   { where += ` AND o.placed_at <= $${idx++}`; params.push(end);   }

  const { rows } = await db.query(`
    SELECT
      o.id, o.placed_at, o.status, o.total_amount,
      c.full_name AS client,
      u.full_name AS employe,
      COALESCE(
        json_agg(
          json_build_object(
            'produit', COALESCE(oi.product_name, oi.service_name, '—'),
            'qte',     oi.quantity,
            'pu',      oi.unit_price,
            'total',   oi.total
          )
        ) FILTER (WHERE oi.id IS NOT NULL), '[]'
      ) AS lignes
    FROM app.orders o
    LEFT JOIN app.clients     c  ON c.id  = o.client_id
    LEFT JOIN app.users       u  ON u.id  = o.created_by
    LEFT JOIN app.order_items oi ON oi.order_id = o.id
    ${where}
    GROUP BY o.id, c.full_name, u.full_name
    ORDER BY o.placed_at
  `, params);
  return rows;
}

async function queryStock(start, end) {
  const params = [];
  let where = "WHERE 1=1 AND sm.movement_type = 'out'";
  let idx = 1;
  if (start) { where += ` AND sm.created_at >= $${idx++}`; params.push(start); }
  if (end)   { where += ` AND sm.created_at <= $${idx++}`; params.push(end);   }

  const { rows } = await db.query(`
    SELECT
      sm.created_at, sm.quantity, sm.movement_subtype AS type_sortie,
      sm.reference, sm.movement_type,
      p.name      AS produit,
      u.full_name AS employe
    FROM app.stock_mouvement sm
    LEFT JOIN app.products p ON p.id = sm.product_id
    LEFT JOIN app.users    u ON u.id = sm.created_by
    ${where}
    ORDER BY sm.created_at
  `, params);
  return rows;
}

async function queryDepenses(start, end) {
  const params = [];
  let where = 'WHERE 1=1';
  let idx = 1;
  if (start) { where += ` AND d.created_at >= $${idx++}`; params.push(start); }
  if (end)   { where += ` AND d.created_at <= $${idx++}`; params.push(end);   }

  const { rows } = await db.query(`
    SELECT
      d.created_at, d.description, d.montant, d.categorie, d.statut,
      u.full_name AS employe
    FROM app.depenses d
    LEFT JOIN app.users u ON u.id = d.created_by
    ${where}
    ORDER BY d.created_at
  `, params);
  return rows;
}

// ── Excel builder ─────────────────────────────────────────────────────────────

async function buildExcel(filename, sources, ventes, sorties, depenses, periodLabel) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RealTech Print';
  wb.created = new Date();

  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
  const ALT_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
  const TOTAL_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } };

  function styleHeader(row) {
    row.eachCell(cell => {
      cell.fill = HEADER_FILL; cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    row.height = 28;
  }
  function styleRow(row, i) {
    if (i % 2 === 0) row.eachCell(c => { c.fill = ALT_FILL; });
    row.eachCell(c => { c.alignment = { vertical: 'middle', wrapText: true }; c.font = { name: 'Calibri', size: 10 }; });
    row.height = 20;
  }
  function addTitle(sheet, title, cols) {
    const r = sheet.insertRow(1, [title]);
    sheet.mergeCells(1, 1, 1, cols);
    const c = r.getCell(1);
    c.font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' }, name: 'Calibri' };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
    r.height = 34;
  }
  function fmtTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ── Feuille Ventes ──
  if (sources.ventes !== false) {
    const ws = wb.addWorksheet('Ventes', { tabColor: { argb: 'FF1E8449' } });
    ws.columns = [
      { header: 'Date & Heure',       key: 'date',    width: 18 },
      { header: 'Client',             key: 'client',  width: 22 },
      { header: 'Employé',            key: 'employe', width: 22 },
      { header: 'Produits/Services',  key: 'lignes',  width: 42 },
      { header: 'Statut',             key: 'statut',  width: 14 },
      { header: 'Montant (FCFA)',     key: 'montant', width: 16 },
    ];
    styleHeader(ws.getRow(1));
    let total = 0;
    ventes.forEach((v, i) => {
      const lignesTxt = (v.lignes || []).map(l => `${l.produit} ×${l.qte}`).join(' | ');
      const row = ws.addRow({
        date: fmtTime(v.placed_at), client: v.client || '—', employe: v.employe || '—',
        lignes: lignesTxt || '—', statut: v.status, montant: parseFloat(v.total_amount || 0),
      });
      row.getCell('montant').numFmt = '#,##0.00';
      styleRow(row, i);
      total += parseFloat(v.total_amount || 0);
    });
    const tr = ws.addRow({ date: '', client: '', employe: '', lignes: '', statut: 'TOTAL', montant: total });
    tr.eachCell(c => { c.fill = TOTAL_FILL; c.font = { bold: true, name: 'Calibri' }; });
    tr.getCell('montant').numFmt = '#,##0.00';
    addTitle(ws, `Ventes — ${periodLabel}`, 6);
  }

  // ── Feuille Stock ──
  if (sources.stock !== false) {
    const ws = wb.addWorksheet('Sorties Stock', { tabColor: { argb: 'FFE67E22' } });
    ws.columns = [
      { header: 'Date & Heure',   key: 'date',    width: 18 },
      { header: 'Produit',        key: 'produit', width: 28 },
      { header: 'Quantité',       key: 'qte',     width: 12 },
      { header: 'Motif',          key: 'motif',   width: 20 },
      { header: 'Référence',      key: 'ref',     width: 22 },
      { header: 'Employé',        key: 'employe', width: 22 },
    ];
    styleHeader(ws.getRow(1));
    let totalQte = 0;
    sorties.forEach((s, i) => {
      const row = ws.addRow({
        date: fmtTime(s.created_at), produit: s.produit || '—',
        qte: parseInt(s.quantity || 0), motif: s.type_sortie || '—',
        ref: s.reference || '—', employe: s.employe || '—',
      });
      styleRow(row, i);
      totalQte += parseInt(s.quantity || 0);
    });
    const tr = ws.addRow({ date: '', produit: 'TOTAL', qte: totalQte, motif: '', ref: '', employe: '' });
    tr.eachCell(c => { c.fill = TOTAL_FILL; c.font = { bold: true, name: 'Calibri' }; });
    addTitle(ws, `Sorties de Stock — ${periodLabel}`, 6);
  }

  // ── Feuille Dépenses ──
  if (sources.depenses !== false) {
    const ws = wb.addWorksheet('Dépenses', { tabColor: { argb: 'FFC0392B' } });
    ws.columns = [
      { header: 'Date & Heure',    key: 'date',        width: 18 },
      { header: 'Description',     key: 'description', width: 35 },
      { header: 'Catégorie',       key: 'categorie',   width: 20 },
      { header: 'Statut',          key: 'statut',      width: 14 },
      { header: 'Montant (FCFA)',  key: 'montant',     width: 16 },
      { header: 'Employé',         key: 'employe',     width: 22 },
    ];
    styleHeader(ws.getRow(1));
    let total = 0;
    depenses.forEach((d, i) => {
      const row = ws.addRow({
        date: fmtTime(d.created_at), description: d.description,
        categorie: d.categorie || '—', statut: d.statut || '—',
        montant: parseFloat(d.montant || 0), employe: d.employe || '—',
      });
      row.getCell('montant').numFmt = '#,##0.00';
      styleRow(row, i);
      total += parseFloat(d.montant || 0);
    });
    const tr = ws.addRow({ date: '', description: '', categorie: 'TOTAL', statut: '', montant: total, employe: '' });
    tr.eachCell(c => { c.fill = TOTAL_FILL; c.font = { bold: true, name: 'Calibri' }; });
    tr.getCell('montant').numFmt = '#,##0.00';
    addTitle(ws, `Dépenses — ${periodLabel}`, 6);
  }

  const fp = path.join(EXPORTS_DIR, filename);
  await wb.xlsx.writeFile(fp);
  return fp;
}

// ── CSV builder ───────────────────────────────────────────────────────────────

function buildCSV(ventes, sorties, depenses) {
  const rows = [];

  rows.push(['=== VENTES ==='], ['Date', 'Client', 'Employé', 'Produits', 'Statut', 'Montant (FCFA)']);
  ventes.forEach(v => {
    const lignes = (v.lignes || []).map(l => `${l.produit} ×${l.qte}`).join(' | ');
    rows.push([
      v.placed_at ? new Date(v.placed_at).toLocaleString('fr-FR') : '—',
      v.client || '—', v.employe || '—', lignes || '—', v.status,
      parseFloat(v.total_amount || 0).toFixed(2),
    ]);
  });

  rows.push([], ['=== SORTIES STOCK ==='], ['Date', 'Produit', 'Quantité', 'Motif', 'Référence', 'Employé']);
  sorties.forEach(s => {
    rows.push([
      s.created_at ? new Date(s.created_at).toLocaleString('fr-FR') : '—',
      s.produit || '—', s.quantity, s.type_sortie || '—', s.reference || '—', s.employe || '—',
    ]);
  });

  rows.push([], ['=== DÉPENSES ==='], ['Date', 'Description', 'Catégorie', 'Statut', 'Montant (FCFA)', 'Employé']);
  depenses.forEach(d => {
    rows.push([
      d.created_at ? new Date(d.created_at).toLocaleString('fr-FR') : '—',
      d.description, d.categorie || '—', d.statut || '—',
      parseFloat(d.montant || 0).toFixed(2), d.employe || '—',
    ]);
  });

  return '\uFEFF' + rows.map(r =>
    r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

async function listRapports(opts = {}) {
  const limit  = Math.min(opts.limit  || 200, 2000);
  const offset = opts.offset || 0;
  const { rows } = await db.query(
    `SELECT r.*, u.full_name AS user_name
     FROM app.rapports r
     LEFT JOIN app.users u ON u.id = r.user_id
     ORDER BY r.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function createRapport({ user_id = null, type_rapport, format_rapport, parameters = {} } = {}) {
  ensureExportsDir();

  const start = parameters.start || null;
  // End of day for end date
  let end = parameters.end || null;
  if (end && !end.includes('T')) {
    end = end + 'T23:59:59.999Z';
  }

  const sources = parameters.sources || { ventes: true, stock: true, depenses: true };

  const periodLabel = (() => {
    if (!start) return 'Toutes périodes';
    const s = new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const e = end ? new Date(end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'aujourd\'hui';
    return start === (end ? end.slice(0, 10) : '') ? s : `${s} → ${e}`;
  })();

  // Fetch data from all requested sources
  const [ventes, sorties, depenses] = await Promise.all([
    sources.ventes  !== false ? queryVentes(start, end)   : Promise.resolve([]),
    sources.stock   !== false ? queryStock(start, end)    : Promise.resolve([]),
    sources.depenses!== false ? queryDepenses(start, end) : Promise.resolve([]),
  ]);

  const rowsCount = ventes.length + sorties.length + depenses.length;
  let filename = null;

  if (format_rapport === 'xlsx' || format_rapport === 'xls') {
    filename = `rapport_${type_rapport}_${(start || 'all').slice(0, 10)}_${uuidv4().slice(0, 8)}.xlsx`;
    await buildExcel(filename, sources, ventes, sorties, depenses, periodLabel);
  } else if (format_rapport === 'csv') {
    filename = `rapport_${type_rapport}_${(start || 'all').slice(0, 10)}_${uuidv4().slice(0, 8)}.csv`;
    const csv = buildCSV(ventes, sorties, depenses);
    fs.writeFileSync(path.join(EXPORTS_DIR, filename), csv, 'utf8');
  }

  const insert = await db.query(
    `INSERT INTO app.rapports (user_id, type_rapport, format_rapport, parameters, filename, rows_count, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      user_id, type_rapport, format_rapport,
      JSON.stringify(parameters), filename, rowsCount,
      JSON.stringify({ generated_via: 'admin_panel', sources }),
    ]
  );

  const created = insert.rows[0];
  const downloadUrl = filename ? `/api/admin/rapports/download/${filename}` : null;
  return { report: created, filename, download: downloadUrl };
}

module.exports = { listRapports, createRapport };
