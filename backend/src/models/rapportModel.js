const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const stockModel = require('./stockMouvementModel');
const { v4: uuidv4 } = require('uuid');

const EXPORTS_DIR = path.join(__dirname, '..', '..', 'exports');

async function listRapports(opts = {}) {
  const limit = Math.min(opts.limit || 200, 2000);
  const offset = opts.offset || 0;
  const { rows } = await db.query(
    `SELECT r.*, u.full_name AS user_name FROM app.rapports r LEFT JOIN app.users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function createRapport({ user_id = null, type_rapport, format_rapport, parameters = {} } = {}) {
  // parameters may contain start/end or other filters; we'll fetch movements accordingly
  const start = parameters.start || null;
  const end = parameters.end || null;
  // pull movements for the report
  const movements = await stockModel.listMovements({ start, product_id: parameters.product_id || null, movement_type: parameters.movement_type || null, limit: 10000 });

  let filename = null;
  let rowsCount = Array.isArray(movements) ? movements.length : 0;

  // ensure exports dir exists
  try { fs.mkdirSync(EXPORTS_DIR, { recursive: true }); } catch (e) { }

  if (format_rapport === 'csv' || format_rapport === 'xls') {
    const headers = ['id','product','type','subtype','quantity','reference','date','status','created_by'];
    const rows = movements.map(m => [
      m.id,
      (m.product && m.product.name) || m.product_name || '',
      m.movement_type,
      m.movement_subtype,
      m.quantity,
      m.reference || '',
      m.created_at,
      m.status,
      m.created_by_name || m.created_by || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(','))].join('\n');
    const ext = format_rapport === 'xls' ? 'xls' : 'csv';
    filename = `rapport_${(new Date()).toISOString().slice(0,10)}_${uuidv4()}.${ext}`;
    const fp = path.join(EXPORTS_DIR, filename);
    fs.writeFileSync(fp, csv, 'utf8');
  }

  // For pdf/png/jpg we don't generate server-side file in this basic implementation.

  const insert = await db.query(
    `INSERT INTO app.rapports (user_id, type_rapport, format_rapport, parameters, filename, rows_count, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [user_id, type_rapport, format_rapport, JSON.stringify(parameters || {}), filename, rowsCount, JSON.stringify({ generated_via: 'backend' })]
  );

  const created = insert.rows[0];
  return { report: created, filename, movements };
}

module.exports = { listRapports, createRapport };
