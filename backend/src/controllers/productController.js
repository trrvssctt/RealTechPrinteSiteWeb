const productModel = require('../models/productModel');
const cache = require('../lib/cache');

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
    // store small result in cache for 30 seconds
    cache.set('products:list', opts, rows, 30);
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

    const product = await productModel.getProduct(id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    cache.set('products:get', { id }, product, 300);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = req.body || {};
    const product = await productModel.createProduct(data);
    res.status(201).json({ data: product });
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
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
};

const destroy = async (req, res, next) => {
  try {
    const id = req.params.id;
    const product = await productModel.deleteProduct(id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, get, create, update, destroy };
