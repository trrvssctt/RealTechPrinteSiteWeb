const db = require('../config/db');

const createContact = async ({ name, email, subject, message, ip_address = null, user_agent = null, metadata = null }) => {
  const { rows } = await db.query(
    `INSERT INTO app.contacts (name, email, subject, message, ip_address, user_agent, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [name, email, subject, message, ip_address, user_agent, metadata ? JSON.stringify(metadata) : null]
  );
  return rows[0];
};

const listContacts = async ({ limit = 100, offset = 0, handled = null } = {}) => {
  let sql = `SELECT * FROM app.contacts`;
  const params = [];
  let idx = 1;
  if (handled !== null) {
    sql += ` WHERE is_handled = $${idx}`;
    params.push(handled);
    idx++;
  }
  sql += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);
  const { rows } = await db.query(sql, params);
  return rows;
};

const getContact = async (id) => {
  const { rows } = await db.query('SELECT * FROM app.contacts WHERE id = $1 LIMIT 1', [id]);
  return rows[0];
};

const markHandled = async (id, handled = true) => {
  const { rows } = await db.query('UPDATE app.contacts SET is_handled = $1 WHERE id = $2 RETURNING *', [handled, id]);
  return rows[0];
};

module.exports = { createContact, listContacts, getContact, markHandled };
