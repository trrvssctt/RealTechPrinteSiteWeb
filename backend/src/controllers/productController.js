const productModel = require('../models/productModel');

const list = async (req, res, next) => {
  try {
    const rows = await productModel.listProducts();
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const id = req.params.id;
    const product = await productModel.getProduct(id);
    if (!product) return res.status(404).json({ error: 'Not found' });
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
