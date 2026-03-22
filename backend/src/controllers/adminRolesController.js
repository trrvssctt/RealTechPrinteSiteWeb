const db = require('../config/db');

const listRoles = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id, name, description FROM app.roles ORDER BY name');
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const createRole = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { rows } = await db.query('INSERT INTO app.roles (name, description) VALUES ($1,$2) RETURNING id, name, description', [name, description || null]);
    res.status(201).json({ role: rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM app.roles WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { listRoles, createRole, deleteRole };
