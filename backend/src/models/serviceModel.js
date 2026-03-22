const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

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
  return res.rows;
}

async function getServiceById(id) {
  const res = await pool.query('SELECT * FROM app.services WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function createService(data, userId) {
  const id = uuidv4();
  const sql = `INSERT INTO app.services (id, name, description, price, duration_minutes, is_active, metadata, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
  const params = [id, data.name, data.description || null, data.price || 0, data.duration_minutes || 0, data.is_active !== false, data.metadata || {}, userId || null];
  const res = await pool.query(sql, params);
  return res.rows[0];
}

async function updateService(id, data) {
  const fields = [];
  const params = [];
  let idx = 1;
  if (data.name !== undefined) { fields.push(`name = $${idx++}`); params.push(data.name); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); params.push(data.description); }
  if (data.price !== undefined) { fields.push(`price = $${idx++}`); params.push(data.price); }
  if (data.duration_minutes !== undefined) { fields.push(`duration_minutes = $${idx++}`); params.push(data.duration_minutes); }
  if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); params.push(data.is_active); }
  if (data.metadata !== undefined) { fields.push(`metadata = $${idx++}`); params.push(data.metadata); }
  if (fields.length === 0) return getServiceById(id);
  params.push(id);
  const sql = `UPDATE app.services SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
  const res = await pool.query(sql, params);
  return res.rows[0];
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
