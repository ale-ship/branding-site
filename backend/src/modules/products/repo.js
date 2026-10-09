// @ts-check

/**
 * The back office's view of the catalogue (docs/ORDER_WORKFLOW_SPEC.md, "Price manager"): each
 * quantity-run product's minimum, prices and whether it is on sale.
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

/**
 * Quantity-run (A) products, in the catalogue's order, with their price tiers.
 * @param {Db} db
 * @returns {Promise<Row[]>}
 */
export async function listRunProducts(db) {
  const { rows } = await db.query(`
    SELECT p.slug, p.name, c.name AS category, p.min_qty, p.active,
      COALESCE(json_agg(json_build_object('minQty', t.min_qty, 'unitPrice', t.unit_price) ORDER BY t.min_qty)
        FILTER (WHERE t.product_id IS NOT NULL), '[]') AS tiers
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN price_tiers t ON t.product_id = p.id
    WHERE p.mechanism = 'A'
    GROUP BY p.id, c.name
    ORDER BY p.sort_order, p.id`);
  return rows;
}

/**
 * A quantity-run product, locked for a change, with its tiers.
 * @param {Db} db
 * @param {string} slug
 * @returns {Promise<{ id: number; min_qty: number; active: boolean; tiers: { minQty: number; unitPrice: number }[] } | null>}
 */
export async function lockRunProduct(db, slug) {
  const { rows } = await db.query("SELECT id, min_qty, active FROM products WHERE slug = $1 AND mechanism = 'A' FOR UPDATE", [slug]);
  if (!rows[0]) return null;
  const tiers = await db.query('SELECT min_qty AS "minQty", unit_price AS "unitPrice" FROM price_tiers WHERE product_id = $1 ORDER BY min_qty', [rows[0].id]);
  return { ...rows[0], tiers: tiers.rows };
}

/**
 * @param {Db} db
 * @param {number} id
 * @param {{ minQty: number; active: boolean }} fields
 */
export async function setRunFields(db, id, { minQty, active }) {
  await db.query('UPDATE products SET min_qty = $2, active = $3, updated_at = now() WHERE id = $1', [id, minQty, active]);
}

/**
 * Replaces a product's price tiers.
 * @param {Db} db
 * @param {number} id
 * @param {{ minQty: number; unitPrice: number }[]} tiers
 */
export async function setTiers(db, id, tiers) {
  await db.query('DELETE FROM price_tiers WHERE product_id = $1', [id]);
  await db.query(
    `INSERT INTO price_tiers (product_id, min_qty, unit_price)
     SELECT $1, t.min_qty, t.unit_price FROM unnest($2::integer[], $3::integer[]) AS t(min_qty, unit_price)`,
    [id, tiers.map((t) => t.minQty), tiers.map((t) => t.unitPrice)],
  );
}
