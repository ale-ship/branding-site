// @ts-check

/**
 * Migration 017: data only. The owner's call (22 Oct 2026): the Bahati gate sign leaves the home
 * page too; the SATU Beauty logo takes its place, so the home page keeps its five jobs and shows
 * some logo work. Both stay in "Our work".
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await feature(knex, 'bahati-vocational-training-centre-sign', false);
  await feature(knex, 'satu-beauty-collection-logo', true);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await feature(knex, 'bahati-vocational-training-centre-sign', true);
  await feature(knex, 'satu-beauty-collection-logo', false);
}

/**
 * @param {import('knex').Knex} knex
 * @param {string} slug
 * @param {boolean} on
 */
async function feature(knex, slug, on) {
  await knex.raw(
    `UPDATE content_items SET data = jsonb_set(data, '{featured}', ?::jsonb), updated_at = now() WHERE kind = 'project' AND slug = ?`,
    [JSON.stringify(on), slug],
  );
}
