const db = require('../config/db');

// middleware to require an admin OR employee session via Bearer token
module.exports = async function adminOrEmployeeAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'missing authorization' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid authorization format' });
    const token = parts[1];

    const { rows } = await db.query(
      `SELECT u.id, array_agg(r.name) AS roles
       FROM app.sessions s
       JOIN app.users u ON u.id = s.user_id
       LEFT JOIN app.user_roles ur ON ur.user_id = u.id
       LEFT JOIN app.roles r ON r.id = ur.role_id
       WHERE s.id = $1
       GROUP BY u.id
       LIMIT 1`,
      [token]
    );

    if (!rows[0]) return res.status(401).json({ error: 'invalid session' });
    const rawRoles = rows[0].roles || [];
    const roles = Array.isArray(rawRoles) ? rawRoles.map(r => (r || '').toString().toLowerCase()) : [];
    // accept admin or employee-like roles
    const ok = roles.includes('admin') || roles.includes('employe') || roles.includes('employé') || roles.includes('employee') || roles.includes('staff');
    if (!ok) return res.status(403).json({ error: 'admin or employee required' });

    // attach user id and normalized roles to request
    req.user = { id: rows[0].id, roles };
    next();
  } catch (err) {
    next(err);
  }
};
