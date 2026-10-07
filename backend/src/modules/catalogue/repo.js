// @ts-check

/**
 * The order catalogue's SQL (docs/BACKEND_RUNBOOK.md, step B1). Rows come back in the contract's
 * shapes (`OrderCategory`, `OrderProduct`), so nothing above this file sees a column name.
 *
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderCategory} OrderCategory
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderProduct} OrderProduct
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 */

/**
 * Active categories, in the catalogue's order.
 * @param {Db} db
 * @returns {Promise<OrderCategory[]>}
 */
export async function listCategories(db) {
  const { rows } = await db.query(`
    SELECT slug, name, mechanism, summary, image, service
    FROM categories WHERE active ORDER BY sort_order, id`);
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    mechanism: r.mechanism,
    summary: r.summary,
    image: r.image,
    ...(r.service ? { service: r.service } : {}),
  }));
}

/**
 * Active products of active categories, with their price tiers, in the catalogue's order.
 * @param {Db} db
 * @returns {Promise<OrderProduct[]>}
 */
export async function listProducts(db) {
  const { rows } = await db.query(`
    SELECT p.*, c.slug AS category,
      COALESCE(
        json_agg(json_build_object('minQty', t.min_qty, 'unitPrice', t.unit_price) ORDER BY t.min_qty)
          FILTER (WHERE t.product_id IS NOT NULL),
        '[]'
      ) AS price_tiers
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN price_tiers t ON t.product_id = p.id
    WHERE p.active AND c.active
    GROUP BY p.id, c.slug
    ORDER BY p.sort_order, p.id`);
  return rows.map(toProduct);
}

/**
 * @param {Record<string, any>} r
 * @returns {OrderProduct}
 */
function toProduct(r) {
  const base = {
    slug: r.slug,
    name: r.name,
    category: r.category,
    summary: r.summary,
    image: r.image,
    standardLeadDays: r.standard_lead_days,
    rushAllowed: r.rush_allowed,
    ...(r.rush_max_qty != null ? { rushMaxQty: r.rush_max_qty } : {}),
    brief: r.brief_schema,
  };
  switch (r.mechanism) {
    case 'A':
      return {
        ...base,
        mechanism: 'A',
        ...(r.shop_slug ? { shopSlug: r.shop_slug } : {}),
        priceTiers: r.price_tiers,
        minQuantity: r.min_qty,
        setupFee: r.setup_fee,
        designFee: r.design_fee,
      };
    case 'B':
      return { ...base, mechanism: 'B', surveyFee: r.survey_fee, stages: r.stages };
    default:
      return { ...base, mechanism: 'C', packagePrice: r.package_price, revisionRounds: r.revision_rounds };
  }
}
