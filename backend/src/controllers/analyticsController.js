const db = require('../config/db');

const trackVisit = async (req, res, next) => {
  try {
    const { session_id, user_id, page_path, referrer, user_agent } = req.body;
    // store as audit log entry
    await db.query('INSERT INTO app.audit_logs (user_id, action, payload) VALUES ($1,$2,$3)', [user_id || null, 'visit', JSON.stringify({ session_id, page_path, referrer, user_agent })]);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
};

const listVisits = async (req, res, next) => {
  try {
    const { start, end, limit = 100, offset = 0 } = req.query;
    // build where clause
    const where = ['action = $1'];
    const params = ['visit'];
    let idx = params.length + 1;
    if (start) {
      where.push(`created_at >= $${idx}`);
      params.push(start);
      idx++;
    }
    if (end) {
      where.push(`created_at <= $${idx}`);
      params.push(end);
      idx++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await db.query(`SELECT COUNT(*)::int AS count FROM app.audit_logs ${whereSql}`, params);
    const count = countRes.rows[0]?.count || 0;

    // fetch rows with pagination, parse payload JSON
    const fetchSql = `SELECT id, user_id, action, payload, created_at FROM app.audit_logs ${whereSql} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit);
    params.push(offset);
    const rowsRes = await db.query(fetchSql, params);
    const data = rowsRes.rows.map((r) => {
      let payload = null;
      try { payload = JSON.parse(r.payload); } catch (e) { payload = r.payload; }
      return { id: r.id, user_id: r.user_id, action: r.action, payload, created_at: r.created_at };
    });

    res.json({ data, count });
  } catch (err) {
    next(err);
  }
};

module.exports = { trackVisit, listVisits };
