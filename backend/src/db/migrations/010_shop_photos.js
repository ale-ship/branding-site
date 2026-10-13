// @ts-check
import { orderCategories, orderProducts } from '@noorcom-branding/shared/catalogue/order-catalogue.js';
import { products } from '@noorcom-branding/shared/content/products.js';

/**
 * Migration 010: data only. The owner's own photos of the shop's products (13 Oct 2026,
 * public/images/shop) replace the stock placeholders on the shop, the order form's matching
 * products and their categories. Migration 008 and the catalogue seed never overwrite what is in the
 * database, so this moves a row only while it still shows the old placeholder: a photo staff chose
 * in the back office stays.
 */

/** The placeholder each one showed before, by slug. */
const OLD_PRODUCT = {
  'business-cards': 'business-cards-stack',
  'a4-notebooks': 'notebook',
  'water-bottle-branding': 'water-bottles',
  'mug-branding': 'mug',
  't-shirt-printing': 'tshirts-folded',
  'hoodie-branding': 'hoodie',
  'booklet-printing': 'booklet',
  'banner-stands': 'banner-outdoor',
};
const OLD_CATEGORY = {
  apparel: 'tshirts-rack',
  'corporate-gifts': 'water-bottles',
  stationery: 'business-cards-stack',
  books: 'booklet',
  'large-format': 'banner-outdoor',
};

const placeholder = (/** @type {string} */ name) => `/images/placeholder/${name}.jpg`;

/**
 * @param {import('knex').Knex} knex
 * @param {'new' | 'old'} to
 */
async function swap(knex, to) {
  const pick = (/** @type {{ src: string; alt: string }} */ image, /** @type {string} */ old) =>
    to === 'new' ? { from: placeholder(old), image } : { from: image.src, image: { src: placeholder(old), alt: image.alt } };

  for (const [slug, old] of Object.entries(OLD_PRODUCT)) {
    const shopItem = products.find((p) => p.slug === slug);
    const orderItem = orderProducts.find((p) => p.slug === slug);
    if (shopItem) {
      const { from, image } = pick(shopItem.image, old);
      await knex.raw(
        `UPDATE content_items SET data = jsonb_set(data, '{image}', ?::jsonb), updated_at = now()
         WHERE kind = 'product' AND slug = ? AND data->'image'->>'src' = ?`,
        [JSON.stringify(image), slug, from],
      );
    }
    if (orderItem) {
      const { from, image } = pick(orderItem.image, old);
      await knex.raw(`UPDATE products SET image = ?::jsonb WHERE slug = ? AND image->>'src' = ?`, [JSON.stringify(image), slug, from]);
    }
  }
  for (const [slug, old] of Object.entries(OLD_CATEGORY)) {
    const category = orderCategories.find((c) => c.slug === slug);
    if (!category) continue;
    const { from, image } = pick(category.image, old);
    await knex.raw(`UPDATE categories SET image = ?::jsonb WHERE slug = ? AND image->>'src' = ?`, [JSON.stringify(image), slug, from]);
  }
}

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await swap(knex, 'new');
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await swap(knex, 'old');
}
