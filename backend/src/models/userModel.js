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
  const rawRoles = row.roles || [];
  const roles = Array.isArray(rawRoles) ? rawRoles.map(r => (r || '').toString().toLowerCase()) : [];
  return {
    ...row,
    name: row.full_name || row.name || null,
    roles,
    role: Array.isArray(roles) && roles.length ? roles[0] : null,
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
  const res = await pool.query(
    `SELECT u.*, u.full_name, array_remove(array_agg(r.name), NULL) AS roles
     FROM app.users u
     LEFT JOIN app.user_roles ur ON ur.user_id = u.id
     LEFT JOIN app.roles r ON r.id = ur.role_id
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
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

async function setUserRole(userId, roleId) {
  // replace existing roles for the user with the provided roleId
  await pool.query('DELETE FROM app.user_roles WHERE user_id = $1', [userId]);
  if (roleId) {
    await pool.query('INSERT INTO app.user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, roleId]);
  }
}

async function deleteUser(id) {
  // Instead of hard-deleting the user (which can break foreign key constraints
  // like audit logs), mark the user as inactive. Return the updated user.
  const res = await pool.query(
    `UPDATE app.users SET is_active = false, updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return mapUserRow(res.rows[0]);
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
  setUserRole,
};
