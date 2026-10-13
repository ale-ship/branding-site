// @ts-check
import { pages } from '@noorcom-branding/shared/content/pages.js';
import { projects } from '@noorcom-branding/shared/content/projects.js';
import { services } from '@noorcom-branding/shared/content/services.js';

/**
 * Migration 011: data only. The owner's mock-ups (13 Oct 2026, public/images/mockups) on the home
 * page: the workshop band, three "behind the scenes" photos, the services' photos and three featured
 * sample projects' covers. As in 010, a photo moves only while the old placeholder is still there,
 * so whatever staff chose in the back office stays.
 */

/** @typedef {{ src: string; alt: string }} Photo */

/** [kind, slug, path in the item's data, the placeholder it showed, the photo it shows now]. */
const service = (/** @type {string} */ slug, /** @type {string} */ old) => /** @type {const} */ (['service', slug, ['image'], old, services.find((s) => s.slug === slug)?.image]);
const cover = (/** @type {string} */ slug, /** @type {string} */ old) => /** @type {const} */ (['project', slug, ['cover'], old, projects.find((p) => p.slug === slug)?.cover]);
const home = pages.home;

/** @type {ReadonlyArray<readonly [string, string, readonly string[], string, Photo | undefined]>} */
const SWAPS = [
  service('indoor-branding', 'wall-mural'),
  service('outdoor-branding', 'billboard'),
  service('vehicle-branding', 'van-wrap'),
  service('apparel', 'tshirts-rack'),
  service('corporate-gifts', 'water-bottles'),
  service('stationery', 'business-cards'),
  service('large-format', 'print-wide-format'),
  cover('sample-fleet-livery', 'van-wrap'),
  cover('sample-event-apparel', 'tshirt-print'),
  cover('sample-corporate-gifts', 'water-bottles'),
  ['page', 'home', ['workshop', 'image'], 'print-wide-format', home.workshop.image],
  ['page', 'home', ['inHouse', 'images', '0'], 'print-latex', home.inHouse.images[0]],
  ['page', 'home', ['inHouse', 'images', '1'], 'apparel-press', home.inHouse.images[1]],
  ['page', 'home', ['inHouse', 'images', '3'], 'screen-inks', home.inHouse.images[3]],
];

const placeholder = (/** @type {string} */ name) => `/images/placeholder/${name}.jpg`;

/**
 * @param {import('knex').Knex} knex
 * @param {'new' | 'old'} to
 */
async function swap(knex, to) {
  for (const [kind, slug, path, old, photo] of SWAPS) {
    if (!photo) throw new Error(`no photo for ${kind} ${slug}`);
    const from = to === 'new' ? placeholder(old) : photo.src;
    const next = to === 'new' ? { src: photo.src, alt: photo.alt } : { src: placeholder(old), alt: photo.alt };
    const pg = `{${path.join(',')}}`;
    // Keep anything else on the photo (a caption), change only its src and alt.
    await knex.raw(
      `UPDATE content_items SET data = jsonb_set(data, ?::text[], (data #> ?::text[]) || ?::jsonb), updated_at = now()
       WHERE kind = ? AND slug = ? AND data #>> ?::text[] = ?`,
      [pg, pg, JSON.stringify(next), kind, slug, `{${[...path, 'src'].join(',')}}`, from],
    );
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
