const serviceModel = require('../models/serviceModel');

async function list(req, res) {
  try {
    const q = req.query.q || null;
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    // by default show only active services; allow including inactive via query param
    const includeInactive = req.query.include_inactive === '1' || req.query.include_inactive === 'true' || req.query.show_inactive === '1' || req.query.show_inactive === 'true';
    const rows = await serviceModel.listServices({ limit, offset, q, includeInactive });
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to list services' });
  }
}

async function getOne(req, res) {
  try {
    const id = req.params.id;
    const row = await serviceModel.getServiceById(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Service not found' });
    res.json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to fetch service' });
  }
}

async function create(req, res) {
  try {
    const userId = req.user?.id || null;
    const data = req.body || {};
    if (!data.name) return res.status(400).json({ ok: false, error: 'Name is required' });
    const row = await serviceModel.createService(data, userId);
    res.status(201).json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to create service' });
  }
}

async function update(req, res) {
  try {
    const id = req.params.id;
    const data = req.body || {};
    const row = await serviceModel.updateService(id, data);
    res.json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to update service' });
  }
}

async function remove(req, res) {
  try {
    const id = req.params.id;
    // soft-delete: mark as inactive instead of physical delete
    const row = await serviceModel.updateService(id, { is_active: false });
    if (!row) return res.status(404).json({ ok: false, error: 'Service not found' });
    res.json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to delete service' });
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
};
