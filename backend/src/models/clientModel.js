const pool = require('../config/db');

function mapClientRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.full_name || null,
    email: row.email,
    phone: row.phone,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by_channel: row.created_by_channel,
    created_by_user: row.created_by_user || null,
    updated_by_user: row.updated_by_user || null,
    is_active: row.is_active,
    metadata: row.metadata || {},
  };
}

async function createClient({ id = null, full_name, email, phone, created_by_channel, metadata = {}, created_by_user = null }) {
  if (id) {
    const res = await pool.query(
      `INSERT INTO app.clients (id, full_name, email, phone, created_by_channel, metadata, created_by_user) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, full_name, email, phone || null, created_by_channel || null, metadata, created_by_user]
    );
    return mapClientRow(res.rows[0]);
  }
  const res = await pool.query(
    `INSERT INTO app.clients (full_name, email, phone, created_by_channel, metadata, created_by_user) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [full_name, email, phone || null, created_by_channel || null, metadata, created_by_user]
  );
  return mapClientRow(res.rows[0]);
}

async function getClientById(id) {
  const res = await pool.query(`SELECT * FROM app.clients WHERE id = $1 LIMIT 1`, [id]);
  return mapClientRow(res.rows[0]);
}

async function getClientByEmail(email) {
  const res = await pool.query(`SELECT * FROM app.clients WHERE email = $1 LIMIT 1`, [email]);
  return mapClientRow(res.rows[0]);
}

async function getClientByPhone(phone) {
  const res = await pool.query(`SELECT * FROM app.clients WHERE phone = $1 LIMIT 1`, [phone]);
  return mapClientRow(res.rows[0]);
}

async function listClients({ limit = 100, offset = 0 } = {}) {
  const res = await pool.query(`SELECT * FROM app.clients ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  return res.rows.map(mapClientRow);
}

async function updateClient(id, { full_name, email, phone, created_by_channel, is_active, metadata, updated_by_user = null }) {
  const res = await pool.query(
    `UPDATE app.clients SET full_name = COALESCE($1, full_name), email = COALESCE($2, email), phone = COALESCE($3, phone), created_by_channel = COALESCE($4, created_by_channel), is_active = COALESCE($5, is_active), metadata = COALESCE($6, metadata), updated_by_user = COALESCE($7, updated_by_user), updated_at = now() WHERE id = $8 RETURNING *`,
    [full_name, email, phone, created_by_channel, is_active, metadata, updated_by_user, id]
  );
  return mapClientRow(res.rows[0]);
}

async function softDeleteClient(id) {
  const res = await pool.query(`UPDATE app.clients SET is_active = false, updated_at = now() WHERE id = $1 RETURNING *`, [id]);
  return mapClientRow(res.rows[0]);
}

async function clientStats() {
  const res = await pool.query(`SELECT COUNT(*)::int AS total, SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS active, SUM(CASE WHEN created_at::date = current_date THEN 1 ELSE 0 END)::int AS today FROM app.clients`);
  return res.rows[0];
}

module.exports = {
  createClient,
  getClientById,
  getClientByEmail,
  getClientByPhone,
  listClients,
  updateClient,
  softDeleteClient,
  clientStats,
};
