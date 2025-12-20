const db = require('../config/db');

const listProducts = async (opts = {}) => {
  // opts: { limit, offset, includeImages = true, category_id, search }
  const {
    limit = 100,
    offset = 0,
    includeImages = true,
    category_id = null,
    search = null,
  } = opts;

  // Build selected fields — avoid fetching large text fields by default
  const fields = [
    'p.id', 'p.name', 'p.slug', 'p.price', 'p.image_url', 'p.featured', 'p.stock', 'p.in_stock', 'p.created_at'
  ];

  // include short_description only if explicitly asked (not in opts currently)

  // Join category
  let sql = `SELECT ${fields.join(', ')}, jsonb_build_object('id', c.id, 'name', c.name) AS category`;

  if (includeImages) {
    sql += `, (
        SELECT coalesce(jsonb_agg(jsonb_build_object('url', pi.url, 'alt', pi.alt, 'order', pi.position) ORDER BY pi.position), '[]'::jsonb)
        FROM app.product_images pi WHERE pi.product_id = p.id
      ) AS images`;
  }

  sql += ` FROM app.products p LEFT JOIN app.categories c ON p.category_id = c.id WHERE p.is_active = true`;

  const params = [];
  let idx = 1;
  if (category_id) {
    sql += ` AND p.category_id = $${idx}`;
    params.push(category_id);
    idx++;
  }
  if (search) {
    sql += ` AND (p.name ILIKE $${idx} OR p.short_description ILIKE $${idx} OR p.description ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  sql += ` ORDER BY p.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const { rows } = await db.query(sql, params);
  return rows;
};

const getProduct = async (id) => {
  const { rows } = await db.query(`
    SELECT p.*, jsonb_build_object('id', c.id, 'name', c.name) AS category,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object('url', pi.url, 'alt', pi.alt, 'order', pi.position) ORDER BY pi.position), '[]'::jsonb)
        FROM app.product_images pi WHERE pi.product_id = p.id
      ) AS images
    FROM app.products p
    LEFT JOIN app.categories c ON p.category_id = c.id
    WHERE p.id = $1 LIMIT 1
  `, [id]);
  return rows[0];
};

const createProduct = async (data) => {
  const {
    sku, name, slug, description, price, stock = 0, is_active = true,
    category_id, price_ht = null, tva_rate = null, threshold = null,
    in_stock = true, featured = false, short_description = null, tags = null, image_url = null
  } = data;

  // derive image_url from images if not explicitly provided
  const derivedImageUrl = image_url || (data.images && Array.isArray(data.images) && data.images.length ? data.images.find(img => img.is_primary)?.url || data.images[0].url : null);

  const { rows } = await db.query(
    `INSERT INTO app.products (sku, name, slug, description, price, stock, is_active, category_id, price_ht, tva_rate, threshold, in_stock, featured, short_description, tags, image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [sku, name, slug, description, price, stock, is_active, category_id, price_ht, tva_rate, threshold, in_stock, featured, short_description, tags ? JSON.stringify(tags) : null, derivedImageUrl]
  );

  const product = rows[0];

  // handle images if provided (array of {url, alt, order})
  if (data.images && Array.isArray(data.images) && product) {
    // remove any existing images just in case
    await db.query('DELETE FROM app.product_images WHERE product_id = $1', [product.id]);
    const insertPromises = data.images.map((img, idx) => {
      return db.query('INSERT INTO app.product_images (product_id, url, alt, position) VALUES ($1,$2,$3,$4)', [product.id, img.url, img.alt || null, img.order ?? idx]);
    });
    await Promise.all(insertPromises);
  }

  return getProduct(product.id);
};

const updateProduct = async (id, data) => {
  // fetch existing product to avoid overwriting with undefined/null
  const existing = await getProduct(id);
  if (!existing) return null;

  const merged = {
    sku: data.sku !== undefined ? data.sku : existing.sku,
    name: data.name !== undefined ? data.name : existing.name,
    slug: data.slug !== undefined ? data.slug : existing.slug,
    description: data.description !== undefined ? data.description : existing.description,
    price: data.price !== undefined ? data.price : existing.price,
    stock: data.stock !== undefined ? data.stock : existing.stock,
    is_active: data.is_active !== undefined ? data.is_active : existing.is_active,
    category_id: data.category_id !== undefined ? data.category_id : existing.category_id,
    price_ht: data.price_ht !== undefined ? data.price_ht : existing.price_ht,
    tva_rate: data.tva_rate !== undefined ? data.tva_rate : existing.tva_rate,
    threshold: data.threshold !== undefined ? data.threshold : existing.threshold,
    in_stock: data.in_stock !== undefined ? data.in_stock : existing.in_stock,
    featured: data.featured !== undefined ? data.featured : existing.featured,
    short_description: data.short_description !== undefined ? data.short_description : existing.short_description,
    tags: data.tags !== undefined ? data.tags : existing.tags,
    image_url: data.image_url !== undefined ? data.image_url : existing.image_url
  };

  // derive image_url from images if provided
  if (data.images && Array.isArray(data.images) && data.images.length) {
    merged.image_url = data.images.find(img => img.is_primary)?.url || data.images[0].url;
  }

  const { rows } = await db.query(
    `UPDATE app.products SET
      sku = $1, name = $2, slug = $3, description = $4, price = $5, stock = $6, is_active = $7, category_id = $8,
      price_ht = $9, tva_rate = $10, threshold = $11, in_stock = $12, featured = $13, short_description = $14, tags = $15, image_url = $16
     WHERE id = $17
     RETURNING *`,
    [merged.sku, merged.name, merged.slug, merged.description, merged.price, merged.stock, merged.is_active, merged.category_id, merged.price_ht, merged.tva_rate, merged.threshold, merged.in_stock, merged.featured, merged.short_description, merged.tags ? JSON.stringify(merged.tags) : null, merged.image_url, id]
  );

  const product = rows[0];

  if (data.images && Array.isArray(data.images)) {
    await db.query('DELETE FROM app.product_images WHERE product_id = $1', [id]);
    const insertPromises = data.images.map((img, idx) => {
      return db.query('INSERT INTO app.product_images (product_id, url, alt, position) VALUES ($1,$2,$3,$4)', [id, img.url, img.alt || null, img.order ?? idx]);
    });
    await Promise.all(insertPromises);
  }

  return getProduct(id);
};

const deleteProduct = async (id) => {
  await db.query('DELETE FROM app.product_images WHERE product_id = $1', [id]);
  const { rows } = await db.query('DELETE FROM app.products WHERE id = $1 RETURNING *', [id]);
  return rows[0];
};

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
