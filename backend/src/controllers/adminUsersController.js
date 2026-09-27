const userModel = require('../models/userModel');
const db = require('../config/db');
const bcrypt = require('bcrypt');

const listUsers = async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, includeDeleted } = req.query;
    const users = await userModel.listUsers({
      limit: Number(limit),
      offset: Number(offset),
      includeDeleted: includeDeleted === 'true',
    });
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
    const user = await userModel.createUser({
      name, email, phone,
      password_hash: hash,
      role_id,
      createdBy: req.user?.id || null,
    });
    // if a role_id was provided, also ensure mapping in user_roles
    if (role_id) {
      await userModel.assignRole(user.id, role_id);
    }
    await userModel.logUserAction(req.user?.id || null, 'create_user', {
      user_id: user.id,
      email: user.email,
      role_id: role_id || null,
      created_by: req.user?.id || null,
    });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role_id, is_active, password } = req.body;

    // Charger l'état avant modification pour le log de diff
    const before = await userModel.getUserById(id);

    let password_hash = undefined;
    if (password && String(password).trim() !== '') {
      password_hash = await bcrypt.hash(String(password), 10);
    }

    const user = await userModel.updateUser(id, {
      name, email, phone, role_id, is_active, password_hash,
      updatedBy: req.user?.id || null,
    });
    // if role_id provided, update the user_roles mapping as well
    if (typeof role_id !== 'undefined' && role_id !== null) {
      await userModel.setUserRole(id, role_id);
    }

    // Log détaillé des champs modifiés
    const changes = {};
    if (name && name !== before?.full_name) changes.full_name = { old: before?.full_name, new: name };
    if (email && email !== before?.email) changes.email = { old: before?.email, new: email };
    if (phone && phone !== before?.phone) changes.phone = { old: before?.phone, new: phone };
    if (role_id && role_id !== before?.role_id) changes.role_id = { old: before?.role_id, new: role_id };
    if (is_active !== undefined && is_active !== before?.is_active) changes.is_active = { old: before?.is_active, new: is_active };
    if (password_hash) changes.password = 'changed';

    await userModel.logUserAction(req.user?.id || null, 'update_user', {
      user_id: id,
      updated_by: req.user?.id || null,
      changes,
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedBy = req.user?.id || null;
    const user = await userModel.deleteUser(id, deletedBy);
    await userModel.logUserAction(deletedBy, 'delete_user', {
      user_id: id,
      email: user?.email,
      deleted_by: deletedBy,
      deleted_at: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

const restoreUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const restoredBy = req.user?.id || null;
    const user = await userModel.restoreUser(id, restoredBy);
    if (!user) return res.status(404).json({ error: 'not_found' });
    await userModel.logUserAction(restoredBy, 'restore_user', {
      user_id: id,
      email: user?.email,
      restored_by: restoredBy,
      restored_at: new Date().toISOString(),
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

const listLogs = async (req, res, next) => {
  try {
    const { limit = 200, user_id } = req.query;
    const params = [Number(limit)];
    let filterClause = '';
    if (user_id) {
      params.push(user_id);
      filterClause = `AND ua.user_id = $${params.length}`;
    }
    const { rows } = await db.query(
      `SELECT ua.*, u.email AS user_email, u.full_name AS user_name
       FROM app.user_actions ua
       LEFT JOIN app.users u ON u.id = ua.user_id
       WHERE 1=1 ${filterClause}
       ORDER BY ua.created_at DESC
       LIMIT $1`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/users/:id/history — historique base de données (trigger)
const getUserHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT uh.*, u.full_name AS changed_by_name, u.email AS changed_by_email
       FROM app.users_history uh
       LEFT JOIN app.users u ON u.id = uh.changed_by
       WHERE uh.row_id = $1
       ORDER BY uh.changed_at DESC
       LIMIT 100`,
      [id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
};

// GET /api/admin/users/:id — fiche détaillée d'un utilisateur
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(`
      SELECT u.*,
        r.name AS role_name,
        r.id   AS role_id_from_join,
        del.full_name AS deleted_by_name
      FROM app.users u
      LEFT JOIN app.user_roles ur ON ur.user_id = u.id
      LEFT JOIN app.roles r ON r.id = ur.role_id
      LEFT JOIN app.users del ON del.id = u.deleted_by
      WHERE u.id = $1
      LIMIT 1
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
};

// GET /api/admin/users/:id/activity — tout ce qu'un employé a fait
const getUserActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const days = Math.min(parseInt(req.query.days || '30', 10), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      userRows,
      actionsRows,
      ordersCreatedRows,
      ordersHandledRows,
      stockRows,
      depensesRows,
      sessionsRows,
    ] = await Promise.all([
      // Profil complet
      db.query(`
        SELECT u.*, r.name AS role_name, del.full_name AS deleted_by_name
        FROM app.users u
        LEFT JOIN app.user_roles ur ON ur.user_id = u.id
        LEFT JOIN app.roles r ON r.id = ur.role_id
        LEFT JOIN app.users del ON del.id = u.deleted_by
        WHERE u.id = $1 LIMIT 1
      `, [id]),

      // Actions utilisateur (log)
      db.query(`
        SELECT ua.action, ua.metadata, ua.created_at,
               u.full_name AS actor_name, u.email AS actor_email
        FROM app.user_actions ua
        LEFT JOIN app.users u ON u.id = ua.user_id
        WHERE ua.user_id = $1 OR (ua.metadata->>'user_id' = $1::text)
        ORDER BY ua.created_at DESC
        LIMIT 200
      `, [id]),

      // Commandes CRÉÉES par cet employé
      db.query(`
        SELECT o.id, o.status, o.total_amount, o.placed_at,
               c.full_name AS client_name,
               (SELECT COUNT(*) FROM app.order_items oi WHERE oi.order_id = o.id) AS nb_items
        FROM app.orders o
        LEFT JOIN app.clients c ON c.id = o.client_id
        WHERE o.created_by = $1 AND o.placed_at >= $2
        ORDER BY o.placed_at DESC
        LIMIT 100
      `, [id, since]),

      // Commandes TRAITÉES (traiter_par dans metadata)
      db.query(`
        SELECT o.id, o.status, o.total_amount, o.placed_at,
               c.full_name AS client_name,
               o.traiter_par
        FROM app.orders o
        LEFT JOIN app.clients c ON c.id = o.client_id
        WHERE o.traiter_par @> $1::jsonb
          AND o.placed_at >= $2
        ORDER BY o.placed_at DESC
        LIMIT 100
      `, [JSON.stringify([{ user_id: id }]), since]),

      // Mouvements de stock créés par cet employé
      db.query(`
        SELECT sm.id, sm.movement_type, sm.movement_subtype,
               sm.quantity, sm.reference, sm.status, sm.created_at,
               p.name AS product_name
        FROM app.stock_mouvement sm
        LEFT JOIN app.products p ON p.id = sm.product_id
        WHERE sm.created_by = $1 AND sm.created_at >= $2
        ORDER BY sm.created_at DESC
        LIMIT 100
      `, [id, since]),

      // Dépenses déclarées par cet employé
      db.query(`
        SELECT d.id, d.description, d.montant, d.categorie,
               d.statut, d.created_at,
               v.full_name AS validateur_name, d.validated_at
        FROM app.depenses d
        LEFT JOIN app.users v ON v.id = d.validated_by
        WHERE d.created_by = $1 AND d.created_at >= $2
        ORDER BY d.created_at DESC
        LIMIT 100
      `, [id, since]),

      // Sessions récentes (dernière connexion)
      db.query(`
        SELECT id, created_at, expires_at
        FROM app.sessions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [id]),
    ]);

    if (!userRows.rows[0]) return res.status(404).json({ error: 'not_found' });

    const ordersCreated = ordersCreatedRows.rows;
    const ordersHandled = ordersHandledRows.rows;
    const allOrders = [...ordersCreated];
    for (const o of ordersHandled) {
      if (!allOrders.find(x => x.id === o.id)) allOrders.push(o);
    }

    const depenses = depensesRows.rows;
    const totalDepensesValide = depenses
      .filter(d => d.statut === 'valide')
      .reduce((s, d) => s + parseFloat(d.montant || 0), 0);

    const stockSorties = stockRows.rows.filter(s => s.movement_type === 'out');
    const stockEntrees = stockRows.rows.filter(s => s.movement_type === 'in');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const timeline = [
      ...actionsRows.rows.map(a => ({ type: 'action', icon: 'activity', label: a.action, detail: a.metadata, at: a.created_at })),
      ...ordersCreated.filter(o => new Date(o.placed_at) >= sevenDaysAgo).map(o => ({ type: 'order_created', icon: 'shopping-cart', label: `Commande créée — ${o.client_name || 'Client'}`, detail: { id: o.id, status: o.status, total: o.total_amount }, at: o.placed_at })),
      ...stockRows.rows.filter(s => new Date(s.created_at) >= sevenDaysAgo).map(s => ({ type: 'stock', icon: 'package', label: `Stock ${s.movement_type === 'out' ? 'sortie' : 'entrée'} — ${s.product_name || '?'}`, detail: { qty: s.quantity, ref: s.reference }, at: s.created_at })),
      ...depenses.filter(d => new Date(d.created_at) >= sevenDaysAgo).map(d => ({ type: 'depense', icon: 'trending-down', label: `Dépense déclarée — ${d.categorie}`, detail: { montant: d.montant, statut: d.statut }, at: d.created_at })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 50);

    const now = new Date();
    const lastSession = sessionsRows.rows[0];
    const isOnline = lastSession && new Date(lastSession.expires_at) > now;
    const lastSeenAt = lastSession ? lastSession.created_at : null;

    res.json({
      user: userRows.rows[0],
      isOnline,
      lastSeenAt,
      summary: {
        ordersCreatedCount:   ordersCreated.length,
        ordersHandledCount:   ordersHandled.length,
        stockMouvementsCount: stockRows.rows.length,
        stockSortiesCount:    stockSorties.length,
        stockEntreesCount:    stockEntrees.length,
        depensesCount:        depenses.length,
        totalDepensesValide,
        actionsCount:         actionsRows.rows.length,
      },
      timeline,
      ordersCreated,
      ordersHandled,
      stockMouvements: stockRows.rows,
      depenses,
      sessions: sessionsRows.rows,
      userActions: actionsRows.rows,
    });
  } catch (err) { next(err); }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  restoreUser,
  listLogs,
  getUser,
  getUserActivity,
  getUserHistory,
};
