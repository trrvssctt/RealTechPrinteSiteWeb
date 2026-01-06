const db = require('../config/db');

// optional auth: if Authorization Bearer present, try to resolve session and attach req.user
module.exports = async function optionalAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return next();
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return next();
    const token = parts[1];

    const { rows } = await db.query(
      `SELECT u.id, u.full_name AS name, u.email, array_remove(array_agg(r.name), NULL) AS roles
       FROM app.sessions s
       JOIN app.users u ON u.id = s.user_id
       LEFT JOIN app.user_roles ur ON ur.user_id = u.id
       LEFT JOIN app.roles r ON r.id = ur.role_id
       WHERE s.id = $1
       GROUP BY u.id, u.full_name, u.email
       LIMIT 1`,
      [token]
    );

    if (rows[0]) {
      const rawRoles = rows[0].roles || [];
      const roles = Array.isArray(rawRoles) ? rawRoles.map(r => (r || '').toString().toLowerCase()) : [];
      req.user = { id: rows[0].id, roles, name: rows[0].name, email: rows[0].email };
    }
    return next();
  } catch (err) {
    // don't block request on auth lookup errors
    console.error('optionalAuth lookup failed', err);
    return next();
  }
};
