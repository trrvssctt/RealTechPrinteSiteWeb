const db = require('../config/db');

// Middleware : session admin valide, non expirée, compte actif et non supprimé
module.exports = async function adminAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'missing authorization' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid authorization format' });
    const token = parts[1];

    const { rows } = await db.query(
      `SELECT u.id, array_agg(r.name) AS roles,
              u.is_active, u.status, s.expires_at
       FROM app.sessions s
       JOIN app.users u ON u.id = s.user_id
       LEFT JOIN app.user_roles ur ON ur.user_id = u.id
       LEFT JOIN app.roles r ON r.id = ur.role_id
       WHERE s.id = $1
       GROUP BY u.id, u.is_active, u.status, s.expires_at
       LIMIT 1`,
      [token]
    );

    if (!rows[0]) return res.status(401).json({ error: 'session invalide' });

    const s = rows[0];

    // Vérifier expiration
    if (s.expires_at && new Date(s.expires_at) < new Date()) {
      await db.query('DELETE FROM app.sessions WHERE id = $1', [token]);
      return res.status(401).json({ error: 'session_expired' });
    }

    // Vérifier que le compte est actif et non supprimé
    if (!s.is_active || s.status === 'supprimé') {
      await db.query('DELETE FROM app.sessions WHERE id = $1', [token]);
      return res.status(403).json({ error: 'Compte désactivé ou supprimé.' });
    }

    const roles = Array.isArray(s.roles) ? s.roles.map(r => (r || '').toLowerCase()) : [];
    if (!roles.includes('admin')) return res.status(403).json({ error: 'admin required' });

    req.user = { id: s.id, roles };
    next();
  } catch (err) {
    next(err);
  }
};
