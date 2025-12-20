const pool = require('../config/db');

async function createUser({ id = null, name, full_name, email, phone, password_hash, role_id, is_active = true }) {
  // support both `name` and `full_name` inputs, map to `full_name` DB column
  const fn = full_name || name || null;
  if (id) {
    const res = await pool.query(
      `INSERT INTO app.users (id, full_name, email, phone, password_hash, role_id, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, fn, email, phone || null, password_hash || null, role_id || null, is_active]
    );
    return mapUserRow(res.rows[0]);
  }
  const res = await pool.query(
    `INSERT INTO app.users (full_name, email, phone, password_hash, role_id, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [fn, email, phone || null, password_hash || null, role_id || null, is_active]
  );
  return mapUserRow(res.rows[0]);
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    ...row,
    name: row.full_name || row.name || null,
  };
}

async function getUserById(id) {
  const res = await pool.query(`SELECT *, full_name FROM app.users WHERE id = $1 LIMIT 1`, [id]);
  return mapUserRow(res.rows[0]);
}

async function getUserByEmail(email) {
  const res = await pool.query(`SELECT *, full_name FROM app.users WHERE email = $1 LIMIT 1`, [email]);
  return mapUserRow(res.rows[0]);
}

async function listUsers({ limit = 100, offset = 0 } = {}) {
  const res = await pool.query(`SELECT *, full_name FROM app.users ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  return res.rows.map(mapUserRow);
}

async function updateUser(id, { name, full_name, email, phone, role_id, is_active }) {
  const fn = full_name || name || null;
  const res = await pool.query(
    `UPDATE app.users SET full_name = COALESCE($1, full_name), email = COALESCE($2, email), phone = COALESCE($3, phone), role_id = COALESCE($4, role_id), is_active = COALESCE($5, is_active), updated_at = now() WHERE id = $6 RETURNING *`,
    [fn, email, phone, role_id, is_active, id]
  );
  return mapUserRow(res.rows[0]);
}

async function deleteUser(id) {
  await pool.query(`DELETE FROM app.users WHERE id = $1`, [id]);
}

async function logUserAction(user_id, action, metadata = {}) {
  await pool.query(`INSERT INTO app.user_actions (user_id, action, metadata) VALUES ($1,$2,$3)`, [user_id, action, JSON.stringify(metadata || {})]);
}

async function ensureRole(roleName) {
  const { rows } = await pool.query('SELECT id FROM app.roles WHERE name = $1 LIMIT 1', [roleName]);
  if (rows[0]) return rows[0].id;
  const res = await pool.query('INSERT INTO app.roles (name) VALUES ($1) RETURNING id', [roleName]);
  return res.rows[0].id;
}

async function assignRole(userId, roleId) {
  await pool.query('INSERT INTO app.user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, roleId]);
}

module.exports = {
  createUser,
  getUserById,
  getUserByEmail,
  listUsers,
  updateUser,
  deleteUser,
  logUserAction,
  ensureRole,
  assignRole,
};
