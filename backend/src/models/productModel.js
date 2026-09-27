const db = require('../config/db');

const listProducts = async (opts = {}) => {
  // opts: { limit, offset, includeImages = true, category_id, search, includeInactive, fullFields }
  const {
    limit = 100,
    offset = 0,
    includeImages = true,
    category_id = null,
    search = null,
    includeInactive = false,
    fullFields = false,
  } = opts;

  const fields = [
    'p.id', 'p.name', 'p.slug', 'p.price',
    'p.image_url', 'p.featured', 'p.stock', 'p.in_stock', 'p.created_at',
  ];
  if (fullFields) {
    fields.push(
      'p.sku', 'p.is_active', 'p.category_id', 'p.description', 'p.short_description',
      'p.price_ht', 'p.tva_rate', 'p.threshold', 'p.tags', 'p.updated_at', 'p.purchase_price'
    );
  }

  const params = [];
  let idx = 1;
  // Les produits supprimés (deleted_at renseigné) sont toujours exclus, y compris
  // de la liste admin. includeInactive garde seulement les produits désactivés.
  const where = ['p.deleted_at IS NULL'];
  if (!includeInactive) where.push('p.is_active = true');

  if (category_id) {
    where.push(`p.category_id = $${idx}`);
    params.push(category_id);
    idx++;
  }
  if (search) {
    where.push(`(p.name ILIKE $${idx} OR p.short_description ILIKE $${idx} OR p.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  // Single query with LEFT JOIN — avoids one correlated subquery per product (N+1)
  let sql;
  if (includeImages) {
    sql = `
      SELECT ${fields.join(', ')},
        jsonb_build_object('id', c.id, 'name', c.name) AS category,
        COALESCE(
          jsonb_agg(
            jsonb_build_object('url', pi.url, 'alt', pi.alt, 'order', pi.position)
            ORDER BY pi.position
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::jsonb
        ) AS images
      FROM app.products p
      LEFT JOIN app.categories c ON p.category_id = c.id
      LEFT JOIN app.product_images pi ON pi.product_id = p.id
      ${whereClause}
      GROUP BY p.id, c.id, c.name
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
  } else {
    sql = `
      SELECT ${fields.join(', ')},
        jsonb_build_object('id', c.id, 'name', c.name) AS category
      FROM app.products p
      LEFT JOIN app.categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
  }

  params.push(limit, offset);
  const { rows } = await db.query(sql, params);
  return rows;
};

// includeCost : le prix d'achat n'est renvoyé qu'aux appels admin (jamais sur le site public)
const getProduct = async (id, { includeCost = true } = {}) => {
  const { rows } = await db.query(`
    SELECT p.*, jsonb_build_object('id', c.id, 'name', c.name) AS category,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object('url', pi.url, 'alt', pi.alt, 'order', pi.position) ORDER BY pi.position), '[]'::jsonb)
        FROM app.product_images pi WHERE pi.product_id = p.id
      ) AS images
    FROM app.products p
    LEFT JOIN app.categories c ON p.category_id = c.id
    WHERE p.id = $1 AND p.deleted_at IS NULL LIMIT 1
  `, [id]);
  if (rows[0] && !includeCost) delete rows[0].purchase_price;
  return rows[0];
};

// Génère un SKU unique de la forme RT-<préfixe catégorie>-NNN (ex: RT-FL-005)
const generateSku = async (category_id, attempt = 0) => {
  let prefix = 'PR';
  if (category_id) {
    const { rows } = await db.query('SELECT name FROM app.categories WHERE id = $1', [category_id]);
    if (rows[0]?.name) {
      const letters = rows[0].name
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^A-Z]/g, '');
      if (letters.length >= 2) prefix = letters.slice(0, 2);
    }
  }
  const base = `RT-${prefix}-`;
  const { rows } = await db.query(
    `SELECT COALESCE(MAX((regexp_match(sku, '([0-9]+)$'))[1]::int), 0) AS maxn
     FROM app.products WHERE sku LIKE $1`,
    [base + '%']
  );
  const next = (rows[0]?.maxn || 0) + 1 + attempt;
  return base + String(next).padStart(3, '0');
};

const createProduct = async (data) => {
  const {
    sku, name, slug, description, price, stock = 0, is_active = true,
    category_id, price_ht = null, tva_rate = null, threshold = null,
    in_stock = true, featured = false, short_description = null, tags = null, image_url = null,
    purchase_price = 0
  } = data;

  // derive image_url from images if not explicitly provided
  const derivedImageUrl = image_url || (data.images && Array.isArray(data.images) && data.images.length ? data.images.find(img => img.is_primary)?.url || data.images[0].url : null);

  const autoSku = !sku || !String(sku).trim();
  let rows;
  // En cas de collision de SKU (création simultanée), on régénère et on réessaie
  for (let attempt = 0; ; attempt++) {
    const finalSku = autoSku ? await generateSku(category_id, attempt) : sku;
    try {
      ({ rows } = await db.query(
        `INSERT INTO app.products (sku, name, slug, description, price, stock, is_active, category_id, price_ht, tva_rate, threshold, in_stock, featured, short_description, tags, image_url, purchase_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [finalSku, name, slug, description, price, stock, is_active, category_id, price_ht, tva_rate, threshold, in_stock, featured, short_description, tags ? JSON.stringify(tags) : null, derivedImageUrl, Math.max(0, Number(purchase_price) || 0)]
      ));
      break;
    } catch (err) {
      if (autoSku && err.code === '23505' && err.constraint === 'products_sku_key' && attempt < 5) continue;
      throw err;
    }
  }

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

  const toInt  = v => (v === '' || v === null || v === undefined) ? null : parseInt(v, 10);
  const toNum  = v => (v === '' || v === null || v === undefined) ? null : parseFloat(v);
  const toStr  = v => (v === '' || v === null || v === undefined) ? null : v;

  const merged = {
    sku:               toStr(data.sku   !== undefined ? data.sku   : existing.sku),
    name:              data.name  !== undefined ? data.name  : existing.name,
    slug:              data.slug  !== undefined ? data.slug  : existing.slug,
    description:       toStr(data.description  !== undefined ? data.description  : existing.description),
    price:             toNum(data.price !== undefined ? data.price : existing.price),
    is_active:         data.is_active !== undefined ? data.is_active : existing.is_active,
    category_id:       toInt(data.category_id !== undefined ? data.category_id : existing.category_id),
    price_ht:          toNum(data.price_ht  !== undefined ? data.price_ht  : existing.price_ht),
    tva_rate:          toNum(data.tva_rate  !== undefined ? data.tva_rate  : existing.tva_rate),
    threshold:         toInt(data.threshold !== undefined ? data.threshold : existing.threshold),
    in_stock:          data.in_stock !== undefined ? data.in_stock : existing.in_stock,
    featured:          data.featured !== undefined ? data.featured : existing.featured,
    short_description: toStr(data.short_description !== undefined ? data.short_description : existing.short_description),
    tags:              data.tags !== undefined ? data.tags : existing.tags,
    image_url:         toStr(data.image_url !== undefined ? data.image_url : existing.image_url),
    purchase_price:    Math.max(0, toNum(data.purchase_price !== undefined ? data.purchase_price : existing.purchase_price) || 0),
  };

  // derive image_url from images if provided
  if (data.images && Array.isArray(data.images) && data.images.length) {
    merged.image_url = data.images.find(img => img.is_primary)?.url || data.images[0].url;
  }

  // stock is intentionally excluded — use stock movements to adjust inventory

  const { rows } = await db.query(
    `UPDATE app.products SET
      sku = $1, name = $2, slug = $3, description = $4, price = $5, is_active = $6, category_id = $7,
      price_ht = $8, tva_rate = $9, threshold = $10, in_stock = $11, featured = $12,
      short_description = $13, tags = $14, image_url = $15, purchase_price = $16
     WHERE id = $17
     RETURNING *`,
    [merged.sku, merged.name, merged.slug, merged.description, merged.price, merged.is_active, merged.category_id, merged.price_ht, merged.tva_rate, merged.threshold, merged.in_stock, merged.featured, merged.short_description, merged.tags ? JSON.stringify(merged.tags) : null, merged.image_url, merged.purchase_price, id]
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
  // Suppression logique : le produit quitte la liste admin et le site, mais reste
  // en base pour préserver l'historique des commandes et mouvements de stock.
  const { rows } = await db.query(
    `UPDATE app.products SET deleted_at = now(), is_active = false, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [id]
  );
  return rows[0];
};

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
