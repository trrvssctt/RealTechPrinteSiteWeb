const db = require('../config/db');

const createUser = async ({ id, email, password_hash, full_name }) => {
  if (id) {
    const q = `INSERT INTO app.users (id, email, password_hash, full_name) VALUES ($1,$2,$3,$4) RETURNING *`;
    const values = [id, email, password_hash, full_name];
    const { rows } = await db.query(q, values);
    return rows[0];
  } else {
    const q = `INSERT INTO app.users (email, password_hash, full_name) VALUES ($1,$2,$3) RETURNING *`;
    const values = [email, password_hash, full_name];
    const { rows } = await db.query(q, values);
    return rows[0];
  }
};

const findUserByEmail = async (email) => {
  const { rows } = await db.query('SELECT * FROM app.users WHERE email = $1 LIMIT 1', [email]);
  return rows[0];
};

const findUserById = async (id) => {
  const { rows } = await db.query('SELECT * FROM app.users WHERE id = $1 LIMIT 1', [id]);
  return rows[0];
};

const ensureRole = async (roleName) => {
  const { rows } = await db.query('SELECT id FROM app.roles WHERE name = $1 LIMIT 1', [roleName]);
  if (rows[0]) return rows[0].id;
  const res = await db.query('INSERT INTO app.roles (name) VALUES ($1) RETURNING id', [roleName]);
  return res.rows[0].id;
};

const assignRole = async (userId, roleId) => {
  await db.query('INSERT INTO app.user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, roleId]);
};

module.exports = { createUser, findUserByEmail, findUserById, ensureRole, assignRole };
