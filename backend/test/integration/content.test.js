import 'dotenv/config';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import knexFactory from 'knex';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { createPool } from '../../src/db/pool.js';
import { defaultRows, seedContent } from '../../src/db/migrations/008_content.js';
import { createStorage } from '../../src/integrations/storage/index.js';
import { runJob } from '../../src/jobs/handlers/index.js';
import { createLogger } from '../../src/lib/logger.js';
import { KINDS, PAGE_SCHEMAS } from '../../src/modules/content/schemas.js';
import { addStaff } from '../../src/modules/staff/service.js';

/**
 * The website editor (owner, 8 Oct 2026), against a real Postgres (TEST_DATABASE_URL; skipped
 * without it): the content the site reads, staff saving, adding, hiding, ordering and removing it,
 * and photos uploaded, cleaned, served and kept while the site shows them.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });
const PASSWORD = 'correct horse battery';

describe('the shipped content', () => {
  it('passes the rules staff edit it under', () => {
    for (const r of defaultRows()) {
      const schema = r.kind === 'page' ? PAGE_SCHEMAS[r.slug] : KINDS[r.kind].schema;
      const result = schema.safeParse(r.data);
      expect(result.success, `${r.kind} ${r.slug}: ${JSON.stringify(result.error?.issues[0])}`).toBe(true);
    }
  });
});

describe.skipIf(!dbUrl)('the website editor', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  const dir = mkdtempSync(join(tmpdir(), 'nb-content-'));
  let app;
  let deps;
  let queued;
  let refreshed;
  const as = {};

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE price_tiers, products, categories, staff_users, content_items, media RESTART IDENTITY CASCADE');
    await knex.seed.run();
    await seedContent(knex);
    queued = [];
    refreshed = [];
    deps = {
      pool,
      redis: null,
      logger,
      config,
      storage: createStorage({ dir }),
      site: { refresh: async (tags) => void refreshed.push(tags) },
      jobs: { enqueue: async (name, data) => void queued.push({ name, data }), schedule: async () => {}, close: async () => {} },
    };
    app = createApp(config, deps);
    for (const role of ['admin', 'designer']) {
      await addStaff(deps, null, { email: `${role}@noorcombranding.co.ke`, name: `The ${role}`, role, password: PASSWORD });
      as[role] = request.agent(app);
      await as[role].post('/api/staff/auth/sign-in').send({ email: `${role}@noorcombranding.co.ke`, password: PASSWORD });
    }
  });
  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    await knex?.destroy();
    await pool?.end();
  });

  const send = (method, path, body) => as.designer[method](`/api/staff${path}`).set('x-requested-with', 'nb-admin').send(body);
  const site = async () => (await request(app).get('/api/content')).body;
  const project = async (slug) => (await as.designer.get(`/api/staff/content/project/${slug}`)).body.item;

  it('gives the site everything, in order, with shop prices from the order form', async () => {
    const c = await site();
    expect(c.services).toHaveLength(7);
    expect(c.projects.map((p) => p.slug)[0]).toBe('sample-fleet-livery');
    expect(c.clients).toHaveLength(8);
    expect(c.pages.home.workshop.facts[1]).toEqual({ value: 'From 10', label: 'Pieces on most branded items' });
    // The shop shows the order catalogue's price and minimum.
    await knex.raw("UPDATE price_tiers SET unit_price = 777 WHERE product_id = (SELECT id FROM products WHERE slug = 'mug-branding') AND min_qty = 10");
    await knex('products').where({ slug: 'mug-branding' }).update({ min_qty: 24 });
    const mug = (await site()).products.find((p) => p.slug === 'mug-branding');
    expect(mug).toMatchObject({ pricePerPiece: 777, minQuantity: 24 });
  });

  it('saves a change, records who made it, and tells the site to refresh', async () => {
    const item = await project('sample-fleet-livery');
    const res = await send('put', '/content/project/sample-fleet-livery', { data: { ...item.data, title: '  Twelve vans, one look  ' }, published: true });
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ slug: 'sample-fleet-livery', updatedBy: 'The designer', data: { title: 'Twelve vans, one look' } });
    expect((await site()).projects[0].title).toBe('Twelve vans, one look');
    expect(queued).toEqual([{ name: 'refresh-site', data: { tags: ['content'] } }]);
    await runJob(deps, 'refresh-site', queued[0].data);
    expect(refreshed).toEqual([['content']]);
    expect(await knex('audit_log').where({ action: 'content-saved' }).first()).toMatchObject({ detail: { kind: 'project', slug: 'sample-fleet-livery' } });
  });

  it('says what is wrong, in words', async () => {
    const item = await project('sample-fleet-livery');
    const bad = await send('put', '/content/project/sample-fleet-livery', { data: { ...item.data, services: [] }, published: true });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('services: Pick at least one service.');
    const outside = await send('put', '/content/project/sample-fleet-livery', { data: { ...item.data, cover: { src: 'https://evil.example/x.jpg', alt: 'x' } } });
    expect(outside.body.message).toBe('cover → src: Pick a photo from the media library.');
    expect((await send('put', '/content/page/home', { data: { nope: true } })).status).toBe(400);
  });

  it('adds, renames, hides, orders and removes projects', async () => {
    const base = (await project('sample-fleet-livery')).data;
    const added = await send('post', '/content/project', { data: { ...base, slug: 'acme-shopfront', title: 'Acme’s new shop front' }, published: false });
    expect(added.status).toBe(201);
    expect((await send('post', '/content/project', { data: { ...base, slug: 'acme-shopfront' } })).status).toBe(409);
    // A draft is not on the site; publishing puts it there, at the top.
    expect((await site()).projects.map((p) => p.slug)).not.toContain('acme-shopfront');
    const moved = await send('put', '/content/project/acme-shopfront', { data: { ...base, slug: 'acme-shop-front', title: 'Acme’s new shop front' }, published: true });
    expect(moved.body.item.slug).toBe('acme-shop-front');
    expect((await site()).projects[0].slug).toBe('acme-shop-front');
    const order = (await site()).projects.map((p) => p.slug).reverse();
    expect((await send('post', '/content/project/order', { slugs: order })).status).toBe(200);
    expect((await site()).projects.map((p) => p.slug)).toEqual(order);
    expect((await send('delete', '/content/project/acme-shop-front')).status).toBe(204);
    expect((await site()).projects.map((p) => p.slug)).not.toContain('acme-shop-front');
  });

  it('keeps services and pages: they can be changed, not removed or hidden', async () => {
    expect((await send('delete', '/content/service/apparel')).status).toBe(409);
    expect((await send('post', '/content/page', { data: {} })).status).toBe(409);
    const home = (await as.designer.get('/api/staff/content/page/home')).body.item.data;
    home.process.steps = home.process.steps.slice(0, 4);
    const res = await send('put', '/content/page/home', { data: home, published: false });
    expect(res.body.item.published).toBe(true);
    expect((await site()).pages.home.process.steps).toHaveLength(4);
  });

  it('gives each client an address from its name', async () => {
    const res = await send('post', '/content/client', { data: { name: 'Safari Tours Ltd', logo: null } });
    expect(res.body.item.slug).toBe('safari-tours-ltd');
    expect((await send('post', '/content/client', { data: { name: 'Safari Tours Ltd', logo: null } })).body.item.slug).toBe('safari-tours-ltd-2');
  });

  it('needs a staff session, and the back office header on changes', async () => {
    expect((await request(app).get('/api/staff/content/project')).status).toBe(401);
    expect((await as.designer.put('/api/staff/content/project/sample-fleet-livery').send({ data: {} })).status).toBe(403);
  });

  describe('photos', () => {
    /** A photo as a phone would take it: big, with where it was taken. */
    const phonePhoto = () =>
      sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#d7000f' } })
        .withExif({ IFD0: { Make: 'PhoneCo', Model: 'X1' }, IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '1/1 17/1 0/1' } })
        .jpeg()
        .toBuffer();
    const upload = (body, type = 'image/jpeg', q = '?filename=shopfront.jpg&alt=Acme%E2%80%99s%20shop%20front') =>
      as.designer.post(`/api/staff/media${q}`).set('x-requested-with', 'nb-admin').set('content-type', type).send(body);

    it('cleans and shrinks an upload, makes a thumbnail, and serves both publicly', async () => {
      const res = await upload(await phonePhoto());
      expect(res.status).toBe(201);
      const m = res.body.media;
      expect(m).toMatchObject({ filename: 'shopfront.jpg', alt: 'Acme’s shop front', width: 2400, height: 1800, uploadedBy: 'The designer' });
      expect(m.src).toMatch(/^\/api\/media\/[a-z0-9]{24}\.jpg$/);
      const file = await request(app).get(m.src).buffer(true);
      expect(file.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      const meta = await sharp(file.body).metadata();
      expect(meta.exif).toBeUndefined();
      expect((await sharp((await request(app).get(m.thumb).buffer(true)).body).metadata()).width).toBe(480);
      expect((await as.designer.get('/api/staff/media')).body.media.map((x) => x.id)).toEqual([m.id]);
    });

    it('keeps a logo’s see-through parts as PNG', async () => {
      const logo = await sharp({ create: { width: 300, height: 120, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
      expect((await upload(logo, 'image/png', '?filename=logo.png')).body.media.src).toMatch(/\.png$/);
    });

    it('refuses what isn’t a photo', async () => {
      const res = await upload(Buffer.from('<svg onload="alert(1)"/>'), 'image/svg+xml');
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('That isn’t a photo we can read. Use JPEG, PNG or WebP.');
      expect((await request(app).get('/api/media/..%2F..%2Fpackage.json')).status).toBe(404);
    });

    it('won’t delete a photo the site shows', async () => {
      const m = (await upload(await phonePhoto())).body.media;
      const item = await project('sample-fleet-livery');
      await send('put', '/content/project/sample-fleet-livery', { data: { ...item.data, cover: { src: m.src, alt: 'A wrapped van' } } });
      const refused = await send('delete', `/media/${m.id}`);
      expect(refused.status).toBe(409);
      expect(refused.body.message).toMatch(/project “sample-fleet-livery”/);
      await send('put', '/content/project/sample-fleet-livery', { data: item.data });
      expect((await send('delete', `/media/${m.id}`)).status).toBe(204);
      expect((await request(app).get(m.src)).status).toBe(404);
    });
  });
});
