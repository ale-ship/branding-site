import 'dotenv/config';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { orderCategories, orderProducts } from '@noorcom-branding/shared/catalogue/order-catalogue.js';
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { estimatePrice } from '@noorcom-branding/shared/rules/pricing.js';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { createPool } from '../../src/db/pool.js';
import { createLogger } from '../../src/lib/logger.js';
import { CACHE_KEY } from '../../src/modules/catalogue/service.js';

/**
 * Step B1 against a real Postgres (TEST_DATABASE_URL in backend/.env; skipped without it): the
 * catalogue goes into the database and comes back unchanged, and the API prices exactly as the
 * order form does in the browser.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });

/** A Redis stand-in for the cache: get and set on a Map, counting reads that hit. */
function fakeCache() {
  const store = new Map();
  const cache = {
    hits: 0,
    get: async (k) => (store.has(k) ? (cache.hits++, store.get(k)) : null),
    set: async (k, v, ...args) => (store.set(k, v), cache.lastSetArgs = args, 'OK'),
    eval: async () => [1, 60],
    store,
  };
  return cache;
}

const body = (over = {}) => ({
  product: 't-shirt-printing',
  quantity: 120,
  brief: { garmentColour: 'Black', sizes: { S: 20, M: 40, L: 40, XL: 20, XXL: 0 }, positions: ['front', 'back'], method: 'screen', printColours: 2 },
  needsDesign: true,
  urgency: 'express',
  handover: { method: 'delivery', zone: 'inner', address: 'Kilimani, Nairobi' },
  ...over,
});

describe.skipIf(!dbUrl)('catalogue and pricing (B1)', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  const app = () => createApp(config, { logger, pool, redis: null });

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE price_tiers, products, categories RESTART IDENTITY CASCADE');
    await knex.seed.run();
  });
  afterAll(async () => {
    await knex?.destroy();
    await pool?.end();
  });

  it('serves the catalogue exactly as shared/catalogue holds it', async () => {
    const res = await request(app()).get('/api/catalogue');
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual(orderCategories);
    expect(res.body.products).toEqual(orderProducts);
    expect(res.headers['cache-control']).toBe('public, max-age=60');
  });

  it('caches the catalogue in Redis for 10 minutes', async () => {
    const cache = fakeCache();
    const cached = createApp(config, { logger, pool, redis: cache });
    await request(cached).get('/api/catalogue');
    expect(cache.store.has(CACHE_KEY)).toBe(true);
    expect(cache.lastSetArgs).toEqual(['EX', 600]);
    const again = await request(cached).get('/api/catalogue');
    expect(cache.hits).toBe(1);
    expect(again.body.products).toEqual(orderProducts);
  });

  it('leaves out inactive products and categories', async () => {
    await knex('products').where({ slug: 'mug-branding' }).update({ active: false });
    await knex('categories').where({ slug: 'design' }).update({ active: false });
    const { body: catalogue } = await request(app()).get('/api/catalogue');
    expect(catalogue.products.map((p) => p.slug)).not.toContain('mug-branding');
    expect(catalogue.products.some((p) => p.category === 'design')).toBe(false);
    expect(catalogue.categories.map((c) => c.slug)).not.toContain('design');
  });

  it('seeds only what is missing, so staff edits survive a deploy', async () => {
    await knex('price_tiers').where({ min_qty: 50 }).whereIn('product_id', knex('products').select('id').where({ slug: 'business-cards' })).update({ unit_price: 20 });
    await knex('products').where({ slug: 'banner-stands' }).del();
    await knex.seed.run();
    const { body: catalogue } = await request(app()).get('/api/catalogue');
    expect(catalogue.products.find((p) => p.slug === 'business-cards').priceTiers[0]).toEqual({ minQty: 50, unitPrice: 20 });
    expect(catalogue.products.find((p) => p.slug === 'banner-stands')).toEqual(orderProducts.find((p) => p.slug === 'banner-stands'));
    expect(catalogue.products).toHaveLength(orderProducts.length);
  });

  it('prices exactly as the order form does, for each mechanism', async () => {
    const requests = [
      body(),
      body({ product: 'business-cards', quantity: 500, brief: { finish: 'spot-uv', sides: 'double', names: 2 }, needsDesign: false, urgency: 'rush', handover: { method: 'pickup' } }),
      body({ product: 'indoor-branding-job', quantity: 1, brief: { siteAddress: 'Loita Street', space: 'office' }, needsDesign: false, urgency: 'standard', handover: { method: 'install', address: 'Loita Street' } }),
      body({ product: 'logo-package', quantity: 1, brief: { format: 'Logo', concepts: '2', files: ['pdf', 'source'] }, needsDesign: true, urgency: 'standard', handover: { method: 'digital' } }),
    ];
    for (const req of requests) {
      const res = await request(app()).post('/api/quotes/price').send(req);
      expect(res.status, req.product).toBe(200);
      const product = orderProducts.find((p) => p.slug === req.product);
      expect(res.body).toEqual(estimatePrice(product, req, nairobiToday(), {}));
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });

  it('prices from the database: a changed tier changes the price', async () => {
    await knex('price_tiers').where({ min_qty: 100 }).whereIn('product_id', knex('products').select('id').where({ slug: 't-shirt-printing' })).update({ unit_price: 590 });
    const res = await request(app()).post('/api/quotes/price').send(body());
    expect(res.body.lines[0]).toMatchObject({ unitPrice: 590, amount: 590 * 120 });
  });

  it('refuses unknown products, short runs and malformed requests', async () => {
    const unknown = await request(app()).post('/api/quotes/price').send(body({ product: 'no-such-thing' }));
    expect(unknown.status).toBe(400);
    expect(unknown.body).toEqual({ error: 'invalid', message: 'That item can’t be ordered online.' });

    const short = await request(app()).post('/api/quotes/price').send(body({ quantity: 10 }));
    expect(short.status).toBe(400);
    expect(short.body.message).toBe('The smallest order is 50 pieces.');

    for (const bad of [
      body({ quantity: '120' }),
      body({ quantity: 0 }),
      body({ urgency: 'yesterday' }),
      body({ handover: { method: 'delivery', address: 'Westlands' } }),
      body({ brief: { sizes: { S: -1 } } }),
      { product: 't-shirt-printing' },
    ]) {
      const res = await request(app()).post('/api/quotes/price').send(bad);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid');
      expect(res.body.details.fields.length).toBeGreaterThan(0);
    }
  });
});

describe('without a database', () => {
  it('answers 503, not an empty catalogue', async () => {
    const res = await request(createApp(config, { logger, pool: null, redis: null })).get('/api/catalogue');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('unavailable');
  });
});
