/**
 * Controller Dépenses
 *
 * Règles anti-fraude :
 * - Employé : peut seulement CRÉER une dépense (lecture seule ensuite)
 * - Admin : peut VALIDER, REJETER ou ANNULER ; jamais de suppression définitive
 * - Chaque dépense est horodatée et liée à son créateur (immuable)
 */

const pool = require('../config/db');
const n8n = require('../services/n8nWebhookService');

const CATEGORIES = [
  'Fournitures de bureau',
  'Transport / Livraison',
  'Alimentation / Repas',
  'Communication',
  'Entretien / Nettoyage',
  'Matériel d\'impression',
  'Autre',
];

// ─── Liste avec filtres ────────────────────────────────────────────────────────
const list = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '200', 10), 2000);
    const offset = parseInt(req.query.offset || '0', 10);
    const date_debut  = req.query.date_debut  || null; // YYYY-MM-DD
    const date_fin    = req.query.date_fin    || null;
    const statut      = req.query.statut      || null; // en_attente|valide|rejete|annule
    const created_by  = req.query.created_by  || null;
    const categorie   = req.query.categorie   || null;

    const params = [];
    let idx = 1;
    const where = [];

    if (date_debut) {
      where.push(`d.created_at::date >= $${idx++}`);
      params.push(date_debut);
    }
    if (date_fin) {
      where.push(`d.created_at::date <= $${idx++}`);
      params.push(date_fin);
    }
    if (statut) {
      where.push(`d.statut = $${idx++}`);
      params.push(statut);
    }
    if (created_by) {
      where.push(`d.created_by = $${idx++}`);
      params.push(created_by);
    }
    if (categorie) {
      where.push(`d.categorie = $${idx++}`);
      params.push(categorie);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Requête principale
    const { rows } = await pool.query(
      `SELECT
         d.*,
         u.full_name  AS employe_name,
         u.email      AS employe_email,
         v.full_name  AS validateur_name
       FROM app.depenses d
       LEFT JOIN app.users u ON u.id = d.created_by
       LEFT JOIN app.users v ON v.id = d.validated_by
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    // Totaux par statut (pour les statistiques)
    const { rows: totaux } = await pool.query(
      `SELECT
         statut,
         COUNT(*)              AS nb,
         COALESCE(SUM(montant), 0) AS total
       FROM app.depenses d
       ${whereClause}
       GROUP BY statut`,
      params
    );

    res.json({ data: rows, totaux, categories: CATEGORIES });
  } catch (err) {
    next(err);
  }
};

// ─── Créer une dépense (employé ou admin) ─────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const { description, montant, categorie, justification } = req.body || {};

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'description_requise' });
    }
    if (!categorie || !CATEGORIES.includes(categorie)) {
      return res.status(400).json({ error: 'categorie_invalide', categories: CATEGORIES });
    }
    const montantNum = parseFloat(montant);
    if (isNaN(montantNum) || montantNum <= 0) {
      return res.status(400).json({ error: 'montant_invalide' });
    }

    const userId = req.user && req.user.id ? req.user.id : null;

    const { rows } = await pool.query(
      `INSERT INTO app.depenses (description, montant, categorie, justification, created_by, statut)
       VALUES ($1, $2, $3, $4, $5, 'en_attente')
       RETURNING *`,
      [description.trim(), montantNum, categorie, justification?.trim() || null, userId]
    );

    // Récupérer avec le nom de l'employé
    const { rows: full } = await pool.query(
      `SELECT d.*, u.full_name AS employe_name, u.email AS employe_email
       FROM app.depenses d
       LEFT JOIN app.users u ON u.id = d.created_by
       WHERE d.id = $1`,
      [rows[0].id]
    );

    res.status(201).json({ data: full[0] });
    setImmediate(() => n8n.notifyDepenseCreated(full[0], req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (err) {
    next(err);
  }
};

// ─── Valider une dépense (admin uniquement) ───────────────────────────────────
const valider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const { rows } = await pool.query(
      `UPDATE app.depenses
       SET statut = 'valide', validated_by = $1, validated_at = now(), commentaire_admin = NULL
       WHERE id = $2 AND statut = 'en_attente'
       RETURNING *`,
      [adminId, id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Dépense introuvable ou déjà traitée' });
    }
    res.json({ data: rows[0] });
    setImmediate(() => n8n.notifyDepenseValidated(rows[0], req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (err) {
    next(err);
  }
};

// ─── Rejeter une dépense (admin uniquement) ───────────────────────────────────
const rejeter = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { commentaire } = req.body || {};

    if (!commentaire || commentaire.trim() === '') {
      return res.status(400).json({ error: 'commentaire_requis_pour_rejet' });
    }

    const { rows } = await pool.query(
      `UPDATE app.depenses
       SET statut = 'rejete', validated_by = $1, validated_at = now(), commentaire_admin = $2
       WHERE id = $3 AND statut = 'en_attente'
       RETURNING *`,
      [adminId, commentaire.trim(), id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Dépense introuvable ou déjà traitée' });
    }
    res.json({ data: rows[0] });
    setImmediate(() => n8n.notifyDepenseRejected(rows[0], req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (err) {
    next(err);
  }
};

// ─── Annuler une dépense (admin uniquement — équivalent soft-delete) ──────────
const annuler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { commentaire } = req.body || {};

    const { rows } = await pool.query(
      `UPDATE app.depenses
       SET statut = 'annule', validated_by = $1, validated_at = now(),
           commentaire_admin = $2
       WHERE id = $3
       RETURNING *`,
      [adminId, commentaire?.trim() || 'Annulée par l\'administrateur', id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Dépense introuvable' });
    res.json({ data: rows[0] });
    setImmediate(() => n8n.notifyDepenseCancelled(rows[0], req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (err) {
    next(err);
  }
};

// ─── Lister les catégories disponibles ───────────────────────────────────────
const getCategories = (req, res) => {
  res.json({ categories: CATEGORIES });
};

module.exports = { list, create, valider, rejeter, annuler, getCategories };
