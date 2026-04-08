const db = require('../config/db');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const saltRounds = 12;

// Session : 24 heures
const SESSION_TTL_HOURS = 24;

// Lockout : 5 échecs → blocage 15 min
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Validation mot de passe : min 8 cars, 1 majuscule, 1 chiffre
function validatePassword(password) {
  if (!password || password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une lettre majuscule.';
  if (!/[0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre.';
  return null; // valide
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    null
  );
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email et mot de passe requis' });

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const existing = await db.query('SELECT id FROM app.users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'email déjà utilisé' });

    const hash = await bcrypt.hash(password, saltRounds);
    const result = await db.query(
      'INSERT INTO app.users (full_name, email, password_hash, status) VALUES ($1, $2, $3, \'actif\') RETURNING id, full_name, email',
      [name, email, hash]
    );
    const row = result.rows[0];
    const user = { id: row.id, name: row.full_name, email: row.email };
    await db.query(
      'INSERT INTO app.user_actions (user_id, action, metadata) VALUES ($1, $2, $3)',
      [user.id, 'register', JSON.stringify({ email: user.email })]
    );
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email et mot de passe requis' });

    const ip = getClientIp(req);

    const result = await db.query(
      `SELECT id, password_hash, is_active, status,
              failed_login_attempts, locked_until
       FROM app.users WHERE email = $1`,
      [email]
    );

    // Délai constant pour ne pas révéler si l'email existe (timing attack)
    if (!result.rows.length) {
      await bcrypt.hash('dummy_timing_protection', saltRounds);
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const user = result.rows[0];

    // Compte supprimé ou désactivé
    if (user.status === 'supprimé') {
      return res.status(403).json({ error: 'Ce compte a été supprimé.' });
    }
    if (user.is_active === false) {
      return res.status(403).json({ error: 'Compte désactivé. Contactez un administrateur.' });
    }

    // Vérifier le blocage temporaire
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({
        error: `Compte temporairement bloqué après plusieurs tentatives échouées. Réessayez dans ${remaining} minute(s).`,
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null;

      await db.query(
        `UPDATE app.users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
        [attempts, lockedUntil, user.id]
      );

      await db.query(
        'INSERT INTO app.user_actions (user_id, action, metadata) VALUES ($1, $2, $3)',
        [user.id, 'login_failed', JSON.stringify({ email, ip, attempts })]
      );

      if (lockedUntil) {
        return res.status(429).json({
          error: `Trop de tentatives échouées. Compte bloqué pendant ${LOCKOUT_MINUTES} minutes.`,
        });
      }
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    // Connexion réussie : réinitialiser le compteur, mettre à jour last_login
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO app.sessions (id, user_id, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [token, user.id, expiresAt, ip, req.headers['user-agent'] || null]
    );

    await db.query(
      `UPDATE app.users
       SET failed_login_attempts = 0, locked_until = NULL,
           last_login_at = now(), last_login_ip = $1
       WHERE id = $2`,
      [ip, user.id]
    );

    await db.query(
      'INSERT INTO app.user_actions (user_id, action, metadata) VALUES ($1, $2, $3)',
      [user.id, 'login', JSON.stringify({ email, ip })]
    );

    res.json({ session: { access_token: token }, token, expires_at: expiresAt });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    const token = auth?.split(' ')[1];
    if (token) {
      await db.query('DELETE FROM app.sessions WHERE id = $1', [token]);
      // Logguer la déconnexion si on peut récupérer le user_id
      const ip = getClientIp(req);
      const { rows } = await db.query(
        'SELECT user_id FROM app.sessions WHERE id = $1', [token]
      );
      // La session est déjà supprimée, mais on peut loguer via req.user si disponible
      if (req.user?.id) {
        await db.query(
          'INSERT INTO app.user_actions (user_id, action, metadata) VALUES ($1, $2, $3)',
          [req.user.id, 'logout', JSON.stringify({ ip })]
        ).catch(() => {});
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      const { rows } = await db.query(
        `SELECT u.id, u.full_name AS name, u.email, u.phone, u.is_active, u.status,
                u.last_login_at, array_remove(array_agg(r.name), NULL) AS roles
         FROM app.users u
         LEFT JOIN app.user_roles ur ON ur.user_id = u.id
         LEFT JOIN app.roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id, u.full_name, u.email, u.phone, u.is_active, u.status, u.last_login_at
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
      `SELECT u.id, u.full_name AS name, u.email, u.phone, u.is_active, u.status,
              u.last_login_at, array_remove(array_agg(r.name), NULL) AS roles
       FROM app.sessions s
       JOIN app.users u ON u.id = s.user_id
       LEFT JOIN app.user_roles ur ON ur.user_id = u.id
       LEFT JOIN app.roles r ON r.id = ur.role_id
       WHERE s.id = $1
         AND (s.expires_at IS NULL OR s.expires_at > now())
         AND u.is_active = true
         AND COALESCE(u.status, 'actif') != 'supprimé'
       GROUP BY u.id, u.full_name, u.email, u.phone, u.is_active, u.status, u.last_login_at
       LIMIT 1`,
      [token]
    );

    if (!rows[0]) return res.status(401).json({ error: 'session invalide ou expirée' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
};
