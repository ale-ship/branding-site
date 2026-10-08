import 'dotenv/config';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { up as minimumTen } from '../../src/db/migrations/006_minimum_ten.js';
import { createPool } from '../../src/db/pool.js';
import { createLogger } from '../../src/lib/logger.js';
import { CACHE_KEY } from '../../src/modules/catalogue/service.js';
import { addStaff } from '../../src/modules/staff/service.js';

/**
 * Minimums (owner, 8 Oct 2026): 10 pieces by default, and staff set a product's own minimum in the
 * back office. Real Postgres; skipped without it.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });
const PASSWORD = 'correct horse battery';

const priceBody = (quantity) => ({
  product: 'mug-branding',
  quantity,
  brief: {},
  needsDesign: false,
  urgency: 'standard',
  handover: { method: 'pickup' },
});

describe.skipIf(!dbUrl)('product minimums', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  let app, cache;
  const as = {};

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE price_tiers, products, categories, staff_users RESTART IDENTITY CASCADE');
    await knex.seed.run();
    cache = new Map([[CACHE_KEY, 'stale']]);
    const redis = { get: async (k) => cache.get(k) ?? null, set: async (k, v) => (cache.set(k, v), 'OK'), del: async (k) => Number(cache.delete(k)), eval: async () => [1, 60] };
    const deps = { pool, redis, logger, config };
    app = createApp(config, deps);
    for (const role of ['admin', 'designer']) {
      await addStaff(deps, null, { email: `${role}@noorcombranding.co.ke`, name: `The ${role}`, role, password: PASSWORD });
      as[role] = request.agent(app);
      await as[role].post('/api/staff/auth/sign-in').send({ email: `${role}@noorcombranding.co.ke`, password: PASSWORD });
    }
  });
  afterAll(async () => {
    await knex?.destroy();
    await pool?.end();
  });

  const setMin = (role, slug, minQuantity) => as[role].patch(`/api/staff/products/${slug}`).set('x-requested-with', 'nb-admin').send({ minQuantity });

  it('starts every quantity run at 10 pieces, with the first price tier from 10', async () => {
    const { products } = (await as.designer.get('/api/staff/products')).body;
    expect(products.length).toBe(12);
    expect(products.every((p) => p.minQuantity === 10 && p.tiers[0].minQty === 10)).toBe(true);
    // Run on a cold catalogue: 10 is accepted and 9 refused.
    cache.clear();
    expect((await request(app).post('/api/quotes/price').send(priceBody(10))).status).toBe(200);
    expect((await request(app).post('/api/quotes/price').send(priceBody(9))).body.message).toBe('The smallest order is 10 pieces.');
  });

  it('lets an admin set a product’s minimum, which the price and new orders follow at once', async () => {
    const res = await setMin('admin', 'mug-branding', 24);
    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({ slug: 'mug-branding', minQuantity: 24 });
    expect(cache.has(CACHE_KEY)).toBe(false);
    expect((await request(app).post('/api/quotes/price').send(priceBody(20))).body.message).toBe('The smallest order is 24 pieces.');
    expect((await request(app).post('/api/quotes/price').send(priceBody(24))).status).toBe(200);
    const catalogue = (await request(app).get('/api/catalogue')).body;
    expect(catalogue.products.find((p) => p.slug === 'mug-branding').minQuantity).toBe(24);
    const trail = await knex('audit_log').where({ action: 'minimum-changed' }).first();
    expect(trail.detail).toEqual({ product: 'mug-branding', from: 10, to: 24 });
  });

  it('is for admins only, with a whole number, on a product that exists', async () => {
    expect((await setMin('designer', 'mug-branding', 20)).status).toBe(403);
    expect((await setMin('admin', 'mug-branding', 0)).status).toBe(400);
    expect((await setMin('admin', 'mug-branding', 2.5)).status).toBe(400);
    expect((await setMin('admin', 'no-such-thing', 20)).status).toBe(404);
    // Site jobs and design-only work have no minimum to set.
    expect((await setMin('admin', 'poster-design', 20)).status).toBe(404);
  });

  it('moves products still on the old 50 to 10, and leaves a minimum staff set alone', async () => {
    await knex('products').whereIn('slug', ['mug-branding', 'hoodie-branding']).update({ min_qty: 50 });
    await knex.raw("UPDATE price_tiers SET min_qty = 50 WHERE min_qty = 10 AND product_id IN (SELECT id FROM products WHERE slug IN ('mug-branding', 'hoodie-branding'))");
    await knex('products').where({ slug: 'umbrella-branding' }).update({ min_qty: 30 });
    await minimumTen(knex);
    const rows = await knex('products').whereIn('slug', ['mug-branding', 'hoodie-branding', 'umbrella-branding']).orderBy('slug').select('slug', 'min_qty');
    expect(rows).toEqual([
      { slug: 'hoodie-branding', min_qty: 10 },
      { slug: 'mug-branding', min_qty: 10 },
      { slug: 'umbrella-branding', min_qty: 30 },
    ]);
    const firstTiers = await knex.raw("SELECT min(t.min_qty)::integer AS first FROM price_tiers t JOIN products p ON p.id = t.product_id WHERE p.slug IN ('mug-branding', 'hoodie-branding') GROUP BY p.slug");
    expect(firstTiers.rows.map((r) => r.first)).toEqual([10, 10]);
  });
});
