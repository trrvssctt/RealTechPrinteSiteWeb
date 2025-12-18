const categoryModel = require('../models/categoryModel');

const list = async (req, res, next) => {
  try {
    const rows = await categoryModel.listCategories();
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, slug, description, parent_id, image_url } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    // optionally generate slug from name if not provided
    const _slug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = await categoryModel.listCategories();
    if (existing.find(c => c.slug === _slug)) return res.status(409).json({ error: 'slug already exists' });

    const cat = await categoryModel.createCategory({ name, slug: _slug, description, parent_id, image_url });
    res.status(201).json({ data: cat });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { name, slug, description, parent_id, image_url } = req.body;
    const cat = await categoryModel.updateCategory(id, { name, slug, description, parent_id, image_url });
    if (!cat) return res.status(404).json({ error: 'not found' });
    res.json({ data: cat });
  } catch (err) {
    next(err);
  }
};

const destroy = async (req, res, next) => {
  try {
    const id = req.params.id;
    await categoryModel.deleteCategory(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, create, update, destroy };
