const clientModel = require('../models/clientModel');
const db = require('../config/db');

const listClients = async (req, res, next) => {
  try {
    const { limit = 200, offset = 0 } = req.query;
    const clients = await clientModel.listClients({ limit: Number(limit), offset: Number(offset) });
    res.json({ data: clients });
  } catch (err) {
    next(err);
  }
};

const getClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await clientModel.getClientById(id);
    if (!client) return res.status(404).json({ error: 'client not found' });
    // enrich client with creator/updater info if available
    try {
      if (client.created_by_user) {
        const { rows } = await db.query(`SELECT id, full_name AS name, email FROM app.users WHERE id = $1 LIMIT 1`, [client.created_by_user]);
        client.created_by_user_info = rows[0] || null;
      }
      if (client.updated_by_user) {
        const { rows } = await db.query(`SELECT id, full_name AS name, email FROM app.users WHERE id = $1 LIMIT 1`, [client.updated_by_user]);
        client.updated_by_user_info = rows[0] || null;
      }
    } catch (err) {
      // non blocking: if lookup fails, continue without info
      console.error('could not fetch creator/updater info', err);
    }

    res.json({ data: client });
  } catch (err) {
    next(err);
  }
};

const createClient = async (req, res, next) => {
  try {
    const { full_name, email, phone, created_by_channel, metadata } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    // strict duplicate prevention: if client exists by email or phone, reject
    const existingByEmail = await clientModel.getClientByEmail(email);
    if (existingByEmail) return res.status(409).json({ error: 'email already exists' });
    if (phone) {
      const existingByPhone = await clientModel.getClientByPhone(phone);
      if (existingByPhone) return res.status(409).json({ error: 'phone already exists' });
    }
    const created_by_user = req.user?.id || null;
    const client = await clientModel.createClient({ full_name, email, phone, created_by_channel, metadata, created_by_user });
    // log action if needed
    res.status(201).json({ client });
  } catch (err) {
    next(err);
  }
};

const updateClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    // attach updater id when available
    payload.updated_by_user = req.user?.id || null;
    const client = await clientModel.updateClient(id, payload);
    res.json({ client });
  } catch (err) {
    next(err);
  }
};

const deleteClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    // prevent deletion if there are pending orders for this client
    const { rows } = await db.query(`SELECT COUNT(*)::int AS pending FROM app.orders WHERE client_id = $1 AND status = $2`, [id, 'pending']);
    const pending = rows[0] ? rows[0].pending : 0;
    if (pending > 0) return res.status(400).json({ error: 'client has pending orders' });

    const client = await clientModel.softDeleteClient(id);
    res.json({ client });
  } catch (err) {
    next(err);
  }
};

const stats = async (req, res, next) => {
  try {
    const s = await clientModel.clientStats();
    res.json({ data: s });
  } catch (err) {
    next(err);
  }
};

module.exports = { listClients, getClient, createClient, updateClient, deleteClient, stats };
