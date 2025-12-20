const db = require('../config/db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const saltRounds = 10;

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const existing = await db.query('SELECT id FROM app.users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'email already exists' });
    const hash = await bcrypt.hash(password, saltRounds);
    // insert into full_name to match DB schema
    const result = await db.query(
      'INSERT INTO app.users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email',
      [name, email, hash]
    );
    const row = result.rows[0];
    const user = { id: row.id, name: row.full_name, email: row.email };
    // log registration
    await db.query('INSERT INTO app.user_actions (user_id, action, metadata) VALUES ($1, $2, $3)', [user.id, 'register', JSON.stringify({ email: user.email })]);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const result = await db.query('SELECT id, password_hash FROM app.users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(401).json({ error: 'invalid credentials' });
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    // create session token (stored as id in app.sessions)
    const token = uuidv4();
    await db.query('INSERT INTO app.sessions (id, user_id) VALUES ($1, $2)', [token, user.id]);
    // log login
    await db.query('INSERT INTO app.user_actions (user_id, action, metadata) VALUES ($1, $2, $3)', [user.id, 'login', JSON.stringify({ email })]);
    // return both legacy token and session.access_token shape
    res.json({ session: { access_token: token }, token });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    // support both explicit req.user (from other middleware) or Bearer token
    if (req.user && req.user.id) {
      const { rows } = await db.query(
        `SELECT u.id, u.full_name AS name, u.email, u.phone, u.is_active, array_remove(array_agg(r.name), NULL) AS roles
         FROM app.users u
         LEFT JOIN app.user_roles ur ON ur.user_id = u.id
         LEFT JOIN app.roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id, u.full_name, u.email, u.phone, u.is_active
         LIMIT 1`,
        [req.user.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'user not found' });
      return res.json({ user: rows[0] });
    }

    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'missing authorization' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid authorization format' });
    const token = parts[1];

    const { rows } = await db.query(
      `SELECT u.id, u.full_name AS name, u.email, u.phone, u.is_active, array_remove(array_agg(r.name), NULL) AS roles
       FROM app.sessions s
       JOIN app.users u ON u.id = s.user_id
       LEFT JOIN app.user_roles ur ON ur.user_id = u.id
       LEFT JOIN app.roles r ON r.id = ur.role_id
       WHERE s.id = $1
       GROUP BY u.id, u.full_name, u.email, u.phone, u.is_active
       LIMIT 1`,
      [token]
    );

    if (!rows[0]) return res.status(401).json({ error: 'invalid session' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
};
