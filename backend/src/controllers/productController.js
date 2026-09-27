const productModel = require('../models/productModel');
const cache = require('../lib/cache');
const n8n = require('../services/n8nWebhookService');

const list = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '24', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    const category_id = req.query.category_id || null;
    const search = req.query.q || null;

    const opts = { limit, offset, category_id, search, includeImages: true };

    // cache key based on query options
    const cached = cache.get('products:list', opts);
    if (cached) {
      return res.json({ data: cached, cached: true });
    }

    const rows = await productModel.listProducts(opts);
    // Cache court (30 s) : vidé lors d'une modification, mais seulement dans CE processus
    // (un autre serveur, ex. local vs production, garde sa copie jusqu'à expiration)
    cache.set('products:list', opts, rows, 30);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

// Liste admin : tous les produits (actifs et inactifs) avec tous les champs, sans cache
const listAll = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 1000);
    const offset = parseInt(req.query.offset || '0', 10);
    const rows = await productModel.listProducts({
      limit, offset, includeImages: true, includeInactive: true, fullFields: true,
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const id = req.params.id;
    const cached = cache.get('products:get', { id });
    if (cached) return res.json({ data: cached, cached: true });

    const product = await productModel.getProduct(id, { includeCost: false }); // route publique
    if (!product) return res.status(404).json({ error: 'Not found' });
    cache.set('products:get', { id }, product, 30);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = req.body || {};
    const product = await productModel.createProduct(data);
    cache.clear();
    res.status(201).json({ data: product });
    setImmediate(() => n8n.notifyProductCreated(product, req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = req.body || {};
    const product = await productModel.updateProduct(id, data);
    if (!product) return res.status(404).json({ error: 'Not found' });
    cache.clear();
    res.json({ data: product });
    setImmediate(() => n8n.notifyProductUpdated(product, req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (err) {
    next(err);
  }
};

const destroy = async (req, res, next) => {
  try {
    const id = req.params.id;
    const product = await productModel.deleteProduct(id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    cache.clear();
    res.json({ data: product });
    setImmediate(() => n8n.notifyProductDeleted(product, req.user?.full_name || req.user?.email).catch(() => {}));
  } catch (err) {
    next(err);
  }
};

module.exports = { list, listAll, get, create, update, destroy };
