const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const db = require('../config/db');

const setupAdmin = async (req, res, next) => {
  try {
    const token = req.headers['x-admin-setup-token'] || req.body.token;
    if (!token || token !== process.env.ADMIN_SETUP_TOKEN) return res.status(403).json({ error: 'forbidden' });

    const { email, password, full_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const existing = await userModel.findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const user = await userModel.createUser({ id, email, password_hash: hash, full_name });

    // ensure admin role exists and assign
    const roleId = await userModel.ensureRole('admin');
    await userModel.assignRole(user.id, roleId);

    // create a session for this admin
    const sessionId = uuidv4();
    await db.query('INSERT INTO app.sessions (id, user_id, refresh_token, expires_at, created_at) VALUES ($1,$2,$3,$4,now())', [sessionId, user.id, sessionId, null]);

    const safeUser = { ...user };
    delete safeUser.password_hash;
    res.status(201).json({ user: safeUser, session: { access_token: sessionId } });
  } catch (err) {
    next(err);
  }
};

module.exports = { setupAdmin };
