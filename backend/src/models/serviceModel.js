const pool = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

function flattenMetadata(row) {
  if (!row) return row;
  if (!row.metadata || typeof row.metadata !== 'object') return row;
  const { metadata, ...rest } = row;
  return { ...rest, ...metadata };
}

async function listServices({ limit = 100, offset = 0, q, includeInactive = false } = {}) {
  const params = [];
  let whereClauses = [];

  if (!includeInactive) {
    whereClauses.push('s.is_active = true');
  }

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    whereClauses.push(`(lower(s.name) LIKE $${params.length} OR lower(s.description) LIKE $${params.length})`);
  }

  // limit and offset appended at the end
  params.push(limit);
  params.push(offset);

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `SELECT s.*, u.email as created_by_email FROM app.services s LEFT JOIN app.users u ON u.id = s.created_by ${where} ORDER BY s.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const res = await pool.query(sql, params);
  return res.rows.map(flattenMetadata);
}

async function getServiceById(id) {
  const res = await pool.query('SELECT * FROM app.services WHERE id = $1', [id]);
  return flattenMetadata(res.rows[0]) || null;
}

async function createService(data, userId) {
  const id = uuidv4();
  
  // Extract known DB columns; everything else (incl. purchase_price) goes to metadata
  const {
    name, description, price, duration_minutes, is_active,
    created_by, created_at, updated_at, id: _id, ...metadata
  } = data;

  const sql = `INSERT INTO app.services (id, name, description, price, duration_minutes, is_active, metadata, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
  const params = [
    id,
    name,
    description || null,
    price || 0,
    duration_minutes || 0,
    is_active !== false,
    metadata || {},
    userId || null
  ];
  const res = await pool.query(sql, params);
  return flattenMetadata(res.rows[0]);
}

async function updateService(id, data) {
  const fields = [];
  const params = [];
  let idx = 1;

  // Known DB columns — purchase_price is NOT a column, it lives in metadata
  const knownColumns = ['name', 'description', 'price', 'duration_minutes', 'is_active'];
  
  // If metadata is explicitly provided, use it as base
  let metadata = data.metadata || {};

  for (const [key, value] of Object.entries(data)) {
    if (knownColumns.includes(key)) {
      fields.push(`${key} = $${idx++}`);
      params.push(value);
    } else if (key !== 'id' && key !== 'metadata' && key !== 'created_at' && key !== 'updated_at' && key !== 'created_by') {
      metadata[key] = value;
    }
  }

  // Always update metadata if we have extra fields
  if (Object.keys(metadata).length > 0) {
    fields.push(`metadata = $${idx++}`);
    params.push(metadata);
  } else if (data.metadata !== undefined) {
    fields.push(`metadata = $${idx++}`);
    params.push(data.metadata);
  }

  if (fields.length === 0) return getServiceById(id);
  
  params.push(id);
  const sql = `UPDATE app.services SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
  const res = await pool.query(sql, params);
  const updatedRow = res.rows[0];
  if (!updatedRow) return null;
  return flattenMetadata(updatedRow);
}

async function deleteService(id) {
  await pool.query('DELETE FROM app.services WHERE id = $1', [id]);
  return true;
}

module.exports = {
  listServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
};
