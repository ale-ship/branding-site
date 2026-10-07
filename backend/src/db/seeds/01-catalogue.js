// @ts-check
import { orderCategories, orderProducts } from '@noorcom-branding/shared/catalogue/order-catalogue.js';

/**
 * Seed 01: the order catalogue from shared/catalogue (docs/BACKEND_RUNBOOK.md, step B1).
 *
 * Adds what is missing and never changes what is there: once staff edit a price in the back office
 * (B4), the database is the record, and a deploy (which runs the seeds) must not put the old price
 * back. To reload the catalogue on a development machine: `npm run migrate:rollback`, then
 * `npm run migrate` and `npm run seed`.
 */

/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  await knex.transaction(async (trx) => {
    for (const [i, c] of orderCategories.entries()) {
      await trx('categories')
        .insert({ slug: c.slug, name: c.name, mechanism: c.mechanism, summary: c.summary, image: JSON.stringify(c.image), service: c.service ?? null, sort_order: i })
        .onConflict('slug')
        .ignore();
    }
    const categoryIds = new Map((await trx('categories').select('id', 'slug')).map((r) => [r.slug, r.id]));

    for (const [i, p] of orderProducts.entries()) {
      const row = {
        slug: p.slug,
        category_id: categoryIds.get(p.category),
        mechanism: p.mechanism,
        name: p.name,
        summary: p.summary,
        image: JSON.stringify(p.image),
        standard_lead_days: p.standardLeadDays,
        rush_allowed: p.rushAllowed,
        rush_max_qty: p.rushMaxQty ?? null,
        brief_schema: JSON.stringify(p.brief),
        sort_order: i,
        ...(p.mechanism === 'A' ? { shop_slug: p.shopSlug ?? null, min_qty: p.minQuantity, setup_fee: p.setupFee, design_fee: p.designFee } : {}),
        ...(p.mechanism === 'B' ? { survey_fee: p.surveyFee, stages: JSON.stringify(p.stages) } : {}),
        ...(p.mechanism === 'C' ? { package_price: p.packagePrice, revision_rounds: p.revisionRounds } : {}),
      };
      const inserted = await trx('products').insert(row).onConflict('slug').ignore().returning('id');
      const id = inserted[0]?.id;
      // Tiers only with a new product: an existing product's tiers are the back office's.
      if (id !== undefined && p.mechanism === 'A') {
        await trx('price_tiers').insert(p.priceTiers.map((t) => ({ product_id: id, min_qty: t.minQty, unit_price: t.unitPrice })));
      }
    }
  });
}
