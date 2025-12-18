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

const deleteCategory = async (id) => {
  await db.query('DELETE FROM app.categories WHERE id = $1', [id]);
  return true;
};

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };

