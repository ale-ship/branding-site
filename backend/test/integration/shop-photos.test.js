import 'dotenv/config';
import knexFactory from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import knexConfig from '../../knexfile.js';

/**
 * Migration 010 against a real Postgres (skipped without it): the owner's shop photos replace the
 * placeholders still in the database, and a photo staff chose in the back office stays.
 */
const dbUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!dbUrl)('the shop photos (migration 010)', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const src = async (table, where) => (await knex(table).where(where).first())[table === 'content_items' ? 'data' : 'image'];

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
    await knex.raw('TRUNCATE price_tiers, products, categories RESTART IDENTITY CASCADE');
    await knex.seed.run();
  });
  afterAll(async () => {
    await knex?.destroy();
  });

  it('swaps placeholders for the photos, keeps a staff choice, and goes back down', async () => {
    // As a database from before: placeholders everywhere, then staff pick their own mug photo.
    await knex.migrate.down({ name: '010_shop_photos.js' });
    expect((await src('content_items', { kind: 'product', slug: 'business-cards' })).image.src).toBe('/images/placeholder/business-cards-stack.jpg');
    expect((await src('products', { slug: 'hoodie-branding' })).src).toBe('/images/placeholder/hoodie.jpg');
    expect((await src('categories', { slug: 'apparel' })).src).toBe('/images/placeholder/tshirts-rack.jpg');
    const mine = { src: '/api/media/0123456789abcdef.jpg', alt: 'Our own mugs' };
    await knex.raw(`UPDATE content_items SET data = jsonb_set(data, '{image}', ?::jsonb) WHERE kind = 'product' AND slug = 'mug-branding'`, [JSON.stringify(mine)]);

    await knex.migrate.up({ name: '010_shop_photos.js' });
    expect((await src('content_items', { kind: 'product', slug: 'business-cards' })).image.src).toBe('/images/shop/business-cards.jpg');
    expect((await src('content_items', { kind: 'product', slug: 'mug-branding' })).image).toEqual(mine);
    expect((await src('products', { slug: 'hoodie-branding' })).src).toBe('/images/shop/hoodie-branding.jpg');
    expect((await src('categories', { slug: 'apparel' })).src).toBe('/images/shop/t-shirt-printing.jpg');
    // Products without a photo of their own keep the placeholder.
    expect((await src('content_items', { kind: 'product', slug: 'umbrella-branding' })).image.src).toBe('/images/placeholder/umbrellas.jpg');
  });

  it('puts the photos on the home page, services and projects (011), keeping staff choices', async () => {
    await knex.migrate.down({ name: '011_home_photos.js' });
    const home = async () => (await src('content_items', { kind: 'page', slug: 'home' }));
    expect((await home()).workshop.image.src).toBe('/images/placeholder/print-wide-format.jpg');
    expect((await home()).inHouse.images.map((i) => i.src)).toEqual([
      '/images/placeholder/print-latex.jpg',
      '/images/placeholder/apparel-press.jpg',
      '/images/placeholder/press-offset.jpg',
      '/images/placeholder/screen-inks.jpg',
    ]);
    const mine = { src: '/api/media/0123456789abcdef.jpg', alt: 'Our own van' };
    await knex.raw(`UPDATE content_items SET data = jsonb_set(data, '{image}', ?::jsonb) WHERE kind = 'service' AND slug = 'vehicle-branding'`, [JSON.stringify(mine)]);

    await knex.migrate.up({ name: '011_home_photos.js' });
    expect((await home()).workshop.image.src).toBe('/images/mockups/wide-format-printer.jpg');
    expect((await home()).inHouse.images.map((i) => i.src)).toEqual([
      '/images/mockups/shop-interior.jpg',
      '/images/mockups/polo-embroidery.jpg',
      '/images/placeholder/press-offset.jpg',
      '/images/mockups/reception-sign.jpg',
    ]);
    expect((await src('content_items', { kind: 'service', slug: 'outdoor-branding' })).image.src).toBe('/images/mockups/shop-front.jpg');
    expect((await src('content_items', { kind: 'service', slug: 'vehicle-branding' })).image).toEqual(mine);
    const fleet = (await src('content_items', { kind: 'project', slug: 'sample-fleet-livery' })).cover;
    expect(fleet.src).toBe('/images/mockups/vehicle-fleet.jpg');
    expect(fleet.alt).toContain('Noorcom Group');
  });
});
