const userModel = require('../models/userModel');
const db = require('../config/db');
const bcrypt = require('bcrypt');

const listUsers = async (req, res, next) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const users = await userModel.listUsers({ limit: Number(limit), offset: Number(offset) });
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, phone, password, role_id } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const existing = await userModel.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'email already exists' });
    const hash = password ? await bcrypt.hash(password, 10) : null;
    const user = await userModel.createUser({ name, email, phone, password_hash: hash, role_id });
    // log action
    await userModel.logUserAction(req.user?.id || null, 'create_user', { user_id: user.id, email: user.email });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role_id, is_active } = req.body;
    const user = await userModel.updateUser(id, { name, email, phone, role_id, is_active });
    await userModel.logUserAction(req.user?.id || null, 'update_user', { user_id: id });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    await userModel.deleteUser(id);
    await userModel.logUserAction(req.user?.id || null, 'delete_user', { user_id: id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

const listLogs = async (req, res, next) => {
  try {
    const { limit = 200 } = req.query;
    const { rows } = await db.query(`SELECT ua.*, u.email as user_email FROM app.user_actions ua LEFT JOIN app.users u ON u.id = ua.user_id ORDER BY ua.created_at DESC LIMIT $1`, [Number(limit)]);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, createUser, updateUser, deleteUser, listLogs };
