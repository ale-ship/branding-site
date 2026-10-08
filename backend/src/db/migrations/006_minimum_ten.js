// @ts-check

/**
 * Migration 006: the minimum run is 10 pieces (owner, 8 Oct 2026), down from the stand-in 50. The
 * seed never changes what is in the database, so this moves the products still on the old seed
 * values: a minimum of 50 becomes 10, and a first price tier at 50 starts at 10 (the price for 10 to
 * 49 pieces is the old 50-piece price). A minimum staff set themselves (anything but 50) stays.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    UPDATE price_tiers t SET min_qty = 10
    FROM products p
    WHERE p.id = t.product_id AND p.mechanism = 'A' AND p.min_qty = 50 AND t.min_qty = 50
      AND NOT EXISTS (SELECT 1 FROM price_tiers x WHERE x.product_id = t.product_id AND x.min_qty < 50);
    UPDATE products SET min_qty = 10, updated_at = now() WHERE mechanism = 'A' AND min_qty = 50;
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw(`
    UPDATE products SET min_qty = 50, updated_at = now() WHERE mechanism = 'A' AND min_qty = 10;
    UPDATE price_tiers t SET min_qty = 50
    FROM products p
    WHERE p.id = t.product_id AND p.mechanism = 'A' AND p.min_qty = 50 AND t.min_qty = 10;
  `);
}
