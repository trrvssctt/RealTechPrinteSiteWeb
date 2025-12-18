const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const db = require('../config/db');

const register = async (req, res, next) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const existing = await userModel.findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await userModel.createUser({ id: uuidv4(), email, password_hash: hash, full_name });
    delete user.password_hash;
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await userModel.findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'invalid credentials' });

    // create a simple session row
    const sessionId = uuidv4();
    await db.query('INSERT INTO app.sessions (id, user_id, refresh_token, expires_at) VALUES ($1,$2,$3,$4)', [sessionId, user.id, sessionId, null]);

    // don't send password_hash
    const safeUser = { ...user };
    delete safeUser.password_hash;

    res.json({ session: { access_token: sessionId }, user: safeUser });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    // check Authorization header Bearer <token>
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'no session' });
    const [, token] = auth.split(' ');
    if (!token) return res.status(401).json({ error: 'invalid session' });

    const { rows } = await db.query(
      `SELECT u.id, u.email, u.full_name, array_remove(array_agg(r.name), NULL) AS roles
       FROM app.sessions s
       JOIN app.users u ON u.id = s.user_id
       LEFT JOIN app.user_roles ur ON ur.user_id = u.id
       LEFT JOIN app.roles r ON r.id = ur.role_id
       WHERE s.id = $1
       GROUP BY u.id, u.email, u.full_name
       LIMIT 1`,
      [token]
    );

    if (!rows[0]) return res.status(401).json({ error: 'invalid session' });

    const user = { id: rows[0].id, email: rows[0].email, full_name: rows[0].full_name, roles: rows[0].roles || [] };
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, me };
