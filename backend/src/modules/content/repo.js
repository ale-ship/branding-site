// @ts-check

/**
 * The website's content and photos in Postgres (migration 008).
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {{ kind: string; slug: string; data: any; position: number; published: boolean; updated_at: Date; updated_by_name: string | null }} Item
 * @typedef {{ id: number; key: string; filename: string; content_type: string; bytes: number; width: number; height: number; alt: string; created_at: Date; uploaded_by_name: string | null }} Media
 */

const ITEM = `SELECT c.kind, c.slug, c.data, c.position, c.published, c.updated_at, s.name AS updated_by_name
  FROM content_items c LEFT JOIN staff_users s ON s.id = c.updated_by`;

/**
 * Every published item, in each list's order: what the site shows.
 * @param {Db} db
 * @returns {Promise<Item[]>}
 */
export async function published(db) {
  const { rows } = await db.query(`${ITEM} WHERE c.published ORDER BY c.kind, c.position, c.slug`);
  return rows;
}

/**
 * The live price and minimum of each shop product that is also on the order form: the order
 * catalogue's minimum and its first tier's price.
 * @param {Db} db
 * @returns {Promise<{ shop_slug: string; min_qty: number; unit_price: number }[]>}
 */
export async function shopPrices(db) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (p.shop_slug) p.shop_slug, p.min_qty, t.unit_price
     FROM products p JOIN price_tiers t ON t.product_id = p.id
     WHERE p.shop_slug IS NOT NULL AND p.active AND p.mechanism = 'A'
     ORDER BY p.shop_slug, p.sort_order, t.min_qty`,
  );
  return rows;
}

/**
 * @param {Db} db
 * @param {string} kind
 * @returns {Promise<Item[]>}
 */
export async function list(db, kind) {
  const { rows } = await db.query(`${ITEM} WHERE c.kind = $1 ORDER BY c.position, c.slug`, [kind]);
  return rows;
}

/**
 * @param {Db} db
 * @param {string} kind
 * @param {string} slug
 * @returns {Promise<Item | null>}
 */
export async function get(db, kind, slug) {
  const { rows } = await db.query(`${ITEM} WHERE c.kind = $1 AND c.slug = $2`, [kind, slug]);
  return rows[0] ?? null;
}

/**
 * A new item, at the top of its list.
 * @param {Db} db
 * @param {{ kind: string; slug: string; data: unknown; published: boolean; staffId: number }} item
 */
export async function insert(db, { kind, slug, data, published, staffId }) {
  await db.query(
    `INSERT INTO content_items (kind, slug, data, published, updated_by, position)
     VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT MIN(position) - 1 FROM content_items WHERE kind = $1), 0))`,
    [kind, slug, JSON.stringify(data), published, staffId],
  );
}

/**
 * Saves an item, under a new slug when it changes; false when there is no such item.
 * @param {Db} db
 * @param {{ kind: string; slug: string; newSlug: string; data: unknown; published: boolean; staffId: number }} item
 */
export async function update(db, { kind, slug, newSlug, data, published, staffId }) {
  const { rowCount } = await db.query(
    `UPDATE content_items SET slug = $3, data = $4, published = $5, updated_by = $6, updated_at = now()
     WHERE kind = $1 AND slug = $2`,
    [kind, slug, newSlug, JSON.stringify(data), published, staffId],
  );
  return rowCount === 1;
}

/**
 * @param {Db} db
 * @param {string} kind
 * @param {string} slug
 */
export async function remove(db, kind, slug) {
  const { rowCount } = await db.query('DELETE FROM content_items WHERE kind = $1 AND slug = $2', [kind, slug]);
  return rowCount === 1;
}

/**
 * Puts a list in the given order (slugs not named keep their place after them).
 * @param {Db} db
 * @param {string} kind
 * @param {string[]} slugs
 */
export async function reorder(db, kind, slugs) {
  await db.query(
    `UPDATE content_items c SET position = o.n - 1
     FROM unnest($2::text[]) WITH ORDINALITY AS o(slug, n)
     WHERE c.kind = $1 AND c.slug = o.slug`,
    [kind, slugs],
  );
}

// Photos.

/**
 * @param {Db} db
 * @param {{ key: string; filename: string; type: string; bytes: number; width: number; height: number; alt: string; staffId: number }} m
 * @returns {Promise<number>}
 */
export async function insertMedia(db, m) {
  const { rows } = await db.query(
    `INSERT INTO media (key, filename, content_type, bytes, width, height, alt, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [m.key, m.filename, m.type, m.bytes, m.width, m.height, m.alt, m.staffId],
  );
  return rows[0].id;
}

const MEDIA = `SELECT m.id, m.key, m.filename, m.content_type, m.bytes, m.width, m.height, m.alt, m.created_at, s.name AS uploaded_by_name
  FROM media m LEFT JOIN staff_users s ON s.id = m.uploaded_by`;

/**
 * Newest first; `q` finds a file name or description.
 * @param {Db} db
 * @param {string} q
 * @returns {Promise<Media[]>}
 */
export async function listMedia(db, q) {
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const { rows } = await db.query(`${MEDIA} WHERE $1 = '%%' OR m.filename ILIKE $1 OR m.alt ILIKE $1 ORDER BY m.id DESC LIMIT 500`, [like]);
  return rows;
}

/**
 * @param {Db} db
 * @param {number} id
 * @returns {Promise<Media | null>}
 */
export async function getMedia(db, id) {
  const { rows } = await db.query(`${MEDIA} WHERE m.id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @param {number} id
 * @param {string} alt
 */
export async function setMediaAlt(db, id, alt) {
  const { rowCount } = await db.query('UPDATE media SET alt = $2 WHERE id = $1', [id, alt]);
  return rowCount === 1;
}

/**
 * @param {Db} db
 * @param {number} id
 */
export async function removeMedia(db, id) {
  await db.query('DELETE FROM media WHERE id = $1', [id]);
}

/**
 * The content that shows a photo, by its address.
 * @param {Db} db
 * @param {string} src
 * @returns {Promise<{ kind: string; slug: string }[]>}
 */
export async function usedBy(db, src) {
  const { rows } = await db.query(`SELECT kind, slug FROM content_items WHERE strpos(data::text, $1) > 0 ORDER BY kind, slug`, [JSON.stringify(src)]);
  return rows;
}
