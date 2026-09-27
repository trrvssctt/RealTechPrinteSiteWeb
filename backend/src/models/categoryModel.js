const db = require('../config/db');

const listCategories = async () => {
  const { rows } = await db.query('SELECT * FROM app.categories ORDER BY name');
  return rows;
};

const createCategory = async ({ name, slug, description, parent_id, image_url }) => {
  const q = `INSERT INTO app.categories (name, slug, description, parent_id, image_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
  const values = [name, slug || null, description || null, parent_id || null, image_url || null];
  const { rows } = await db.query(q, values);
  return rows[0];
};

const updateCategory = async (id, { name, slug, description, parent_id, image_url }) => {
  const q = `UPDATE app.categories SET name = COALESCE($1, name), slug = COALESCE($2, slug), description = COALESCE($3, description), parent_id = COALESCE($4, parent_id), image_url = COALESCE($5, image_url) WHERE id = $6 RETURNING *`;
  const values = [name || null, slug || null, description || null, parent_id || null, image_url || null, id];
  const { rows } = await db.query(q, values);
  return rows[0];
};

// Supprime une catégorie. Refusée si des produits ACTIFS l'utilisent encore
// (la base l'interdit : clé étrangère products.category_id). Les produits archivés
// (supprimés) perdent simplement leur catégorie.
// Retour : { deleted: true } | { notFound: true } | { blockedBy: [{ id, name }] }
const deleteCategory = async (id) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: cat } = await client.query('SELECT id FROM app.categories WHERE id = $1 FOR UPDATE', [id]);
    if (!cat[0]) {
      await client.query('ROLLBACK');
      return { notFound: true };
    }
    const { rows: used } = await client.query(
      'SELECT id, name FROM app.products WHERE category_id = $1 AND deleted_at IS NULL ORDER BY name',
      [id]
    );
    if (used.length > 0) {
      await client.query('ROLLBACK');
      return { blockedBy: used };
    }
    await client.query('UPDATE app.products SET category_id = NULL WHERE category_id = $1 AND deleted_at IS NOT NULL', [id]);
    await client.query('DELETE FROM app.categories WHERE id = $1', [id]);
    await client.query('COMMIT');
    return { deleted: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };

