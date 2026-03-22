const rapportModel = require('../models/rapportModel');
const path = require('path');

const list = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 2000);
    const offset = parseInt(req.query.offset || '0', 10);
    const rows = await rapportModel.listRapports({ limit, offset });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id ? req.user.id : null;
    const { type_rapport, format_rapport, parameters } = req.body || {};
    if (!type_rapport || !format_rapport) return res.status(400).json({ error: 'missing_params' });

    const result = await rapportModel.createRapport({ user_id: userId, type_rapport, format_rapport, parameters });

    const downloadUrl = result.filename ? `/api/admin/rapports/download/${result.filename}` : null;

    res.status(201).json({ data: result.report, download: downloadUrl });
  } catch (err) {
    next(err);
  }
};

const download = async (req, res, next) => {
  try {
    const filename = req.params.filename;
    if (!filename) return res.status(400).json({ error: 'missing_filename' });
    const fp = path.join(__dirname, '..', '..', 'exports', filename);
    return res.sendFile(fp);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, create, download };
