// @ts-check

/**
 * The back office's view of the catalogue (docs/ORDER_WORKFLOW_SPEC.md, "Price manager"): for now,
 * each quantity-run product's minimum.
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
 * Sets a quantity-run product's minimum; returns the old and new values, or null if there is no such
 * product.
 * @param {Db} db
 * @param {string} slug
 * @param {number} minimum
 * @returns {Promise<{ before: number; after: number } | null>}
 */
export async function setMinimum(db, slug, minimum) {
  const { rows } = await db.query(
    `UPDATE products p SET min_qty = $2, updated_at = now()
     FROM (SELECT id, min_qty FROM products WHERE slug = $1 AND mechanism = 'A' FOR UPDATE) old
     WHERE p.id = old.id
     RETURNING old.min_qty AS before, p.min_qty AS after`,
    [slug, minimum],
  );
  return rows[0] ?? null;
}
