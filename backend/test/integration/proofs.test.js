import 'dotenv/config';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { createPool } from '../../src/db/pool.js';
import { createStorage } from '../../src/integrations/storage/index.js';
import { runJob } from '../../src/jobs/handlers/index.js';
import { createLogger } from '../../src/lib/logger.js';
import { addStaff } from '../../src/modules/staff/service.js';

/**
 * Step B4's "done when": staff run an order through without the demo controls. Placed, deposit paid
 * by Paybill, a proof uploaded by the designer, changes asked for, a second proof approved, the
 * balance paid, then logged, made ready and handed over by staff. Real Postgres; skipped without it.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });
const PASSWORD = 'correct horse battery';
// A 1 × 1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const CHECKLIST = { spelling: true, colours: true, size: true, quantity: true, colourVariance: true };

const tshirts = (over = {}) => ({
  product: 't-shirt-printing',
  quantity: 120,
  brief: { garmentColour: 'Black', sizes: { S: 20, M: 40, L: 40, XL: 20, XXL: 0 }, positions: ['front'], method: 'screen', printColours: 1 },
  needsDesign: true,
  urgency: 'standard',
  handover: { method: 'pickup' },
  common: { colours: [], typography: 'designer', fonts: '', assets: [], inspiration: [], inspirationLinks: [], text: 'Acme', styles: [], artwork: 'need-design', notes: '' },
  customer: { name: 'Amina Wanjiru', company: 'Acme Ltd', phone: '0722 530 301', email: 'amina@example.co.ke' },
  ...over,
});

describe.skipIf(!dbUrl)('proofs, and an order run through by staff (B4)', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  const dir = mkdtempSync(join(tmpdir(), 'nb-storage-'));
  let queued, deps, app;
  const as = {};

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE price_tiers, products, categories, staff_users, provider_callbacks, c2b_confirmations RESTART IDENTITY CASCADE');
    await knex.raw('UPDATE counters SET value = 0');
    await knex.seed.run();
    queued = [];
    deps = {
      pool,
      redis: null,
      logger,
      config,
      storage: createStorage({ dir }),
      jobs: { enqueue: async (name, data) => void queued.push({ name, data }), schedule: async () => {}, close: async () => {} },
    };
    app = createApp(config, deps);
    for (const role of ['designer']) {
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

  const place = async (over) => (await request(app).post('/api/orders').send(tshirts(over))).body;
  const view = async ({ ref, token }) => (await request(app).get(`/api/orders/${ref}`).set('x-order-token', token)).body;
  const upload = (role, ref, body = PNG, type = 'image/png', note = '') =>
    as[role].post(`/api/staff/orders/${ref}/proofs`).set('x-requested-with', 'nb-admin').set('content-type', type).set('x-proof-note', encodeURIComponent(note)).send(body);
  const customer = ({ ref, token }, path, body) => request(app).post(`/api/orders/${ref}/proofs/${path}`).set('x-order-token', token).send(body);
  const staff = (role, ref, step, body = {}) => as[role].post(`/api/staff/orders/${ref}/${step}`).set('x-requested-with', 'nb-admin').send(body);
  /** A Paybill payment by order number, routed by the worker's handler. */
  async function paybill(ref, amount) {
    await request(app).post('/api/dev/c2b').send({ ref, amount });
    for (const job of queued.splice(0)) if (job.name === 'process-c2b') await runJob(deps, job.name, job.data);
  }

  it('runs an order from placing to handover with no demo controls', async () => {
    const placed = await place();
    let o = await view(placed);
    const total = o.total;
    await paybill(placed.ref, o.dueNow);
    o = await view(placed);
    expect(o.status).toBe('in_design');

    // The designer uploads proof v1; the customer sees it watermarked, behind a signed link.
    const up = await upload('designer', placed.ref, PNG, 'image/png', 'Logo on the chest');
    expect(up.status).toBe(201);
    o = await view(placed);
    expect(o.status).toBe('awaiting_approval');
    expect(o.proofs).toEqual([expect.objectContaining({ version: 1, status: 'pending', note: 'Logo on the chest.', mockup: null })]);
    const image = o.proofs[0].image;
    expect(image).toMatch(/^\/api\/files\/proofs\/NB-\d{6}\/[0-9a-f]{16}\.svg\?exp=\d+&sig=[0-9a-f]{64}$/);
    const file = await request(app).get(image);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/image\/svg\+xml/);
    expect(file.headers['content-security-policy']).toContain("default-src 'none'");
    expect(String(file.body)).toContain('>PROOF</text>');
    // Change the signature's first character, whatever it is.
    expect((await request(app).get(image.replace(/sig=(.)/, (_m, c) => `sig=${c === '0' ? '1' : '0'}`))).status).toBe(404);
    expect((await request(app).get(image.replace(/exp=\d+/, 'exp=1'))).status).toBe(404);
    // Staff can open the original.
    const original = await as.designer.get(`/api/staff/orders/${placed.ref}/proofs/1/original`);
    expect(Buffer.compare(original.body, PNG)).toBe(0);

    // The customer asks for changes with a pinned note; it goes back to design.
    const changes = await customer(placed, '1/changes', { comments: 'Bigger logo please', pins: [{ x: 0.5, y: 0.3, text: 'Here' }] });
    expect(changes.status).toBe(200);
    expect(changes.body).toMatchObject({ status: 'in_design', proofs: [{ version: 1, status: 'changes_requested', comments: 'Bigger logo please', pins: [{ x: 0.5, y: 0.3, text: 'Here' }] }] });

    // v2, approved: the checklist must be complete, and the balance falls due.
    await upload('designer', placed.ref);
    expect((await customer(placed, '1/approve', { checklist: CHECKLIST })).status).toBe(409);
    expect((await customer(placed, '2/approve', { checklist: { ...CHECKLIST, colourVariance: false } })).status).toBe(400);
    const approved = await customer(placed, '2/approve', { checklist: CHECKLIST });
    expect(approved.body).toMatchObject({ status: 'awaiting_balance', dueNow: total - o.amountPaid, duePurpose: 'balance' });

    // The balance is paid: production starts, with the promised date counted from today.
    await paybill(placed.ref, approved.body.dueNow);
    o = await view(placed);
    expect(o).toMatchObject({ status: 'in_production', amountPaid: total, dueNow: 0 });
    expect(o.production.promisedBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // The floor logs the run, marks it ready, and the counter hands it over.
    await staff('designer', placed.ref, 'progress', { pieces: 120 });
    const ready = await staff('designer', placed.ref, 'ready');
    await staff('designer', placed.ref, 'handover', { code: ready.body.order.pickupCode, collector: 'Amina Wanjiru' });
    o = await view(placed);
    expect(o.status).toBe('completed');
    expect(o.events.map((e) => e.text)).toEqual([
      'Order placed.',
      'Deposit paid. A designer is on your brief.',
      'Proof v1 is ready for you to check.',
      'Changes requested on proof v1 (1 pinned note).',
      'Proof v2 is ready for you to check.',
      'Proof v2 approved; the artwork is locked.',
      `Pay the balance of KES ${(total - o.payments[0].amount).toLocaleString('en-KE')} and printing starts.`,
      'Balance paid. Your order is in production.',
      '120 printed. 120 of 120 done.',
      'Ready for pickup. Show your pickup code at the counter.',
      'Collected by Amina Wanjiru with the pickup code.',
      'Order complete. Thank you!',
    ]);
    const templates = await knex('notifications').where({ channel: 'email' }).orderBy('id').pluck('template');
    expect(templates).toEqual(['order-placed', 'payment-received', 'proof-ready', 'proof-ready', 'balance-due', 'payment-received', 'ready', 'completed']);
  });

  it('refuses what isn’t a PNG or JPEG, and a proof outside design', async () => {
    const placed = await place();
    expect((await upload('designer', placed.ref)).status).toBe(409);
    await paybill(placed.ref, (await view(placed)).dueNow);
    const bad = await upload('designer', placed.ref, Buffer.from('not an image'), 'image/png');
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('Upload the proof as a PNG or JPEG image.');
    expect((await upload('designer', placed.ref, Buffer.from('%PDF-1.4'), 'application/pdf')).status).toBe(400);
  });

  it('needs the order’s access to answer a proof', async () => {
    const placed = await place();
    await paybill(placed.ref, (await view(placed)).dueNow);
    await upload('designer', placed.ref);
    expect((await customer({ ...placed, token: 'f'.repeat(32) }, '1/approve', { checklist: CHECKLIST })).status).toBe(404);
    const byPhone = await request(app).post(`/api/orders/${placed.ref}/proofs/1/approve`).set('x-order-phone', '0722530301').send({ checklist: CHECKLIST });
    expect(byPhone.body.status).toBe('awaiting_balance');
  });

  it('sends a design-only order out as files when its proof is approved', async () => {
    const placed = (
      await request(app)
        .post('/api/orders')
        .send({ ...tshirts(), product: 'poster-design', quantity: 1, brief: { format: 'A3 poster', concepts: '1', files: ['pdf'] }, handover: { method: 'digital' } })
    ).body;
    await paybill(placed.ref, (await view(placed)).dueNow);
    await upload('designer', placed.ref);
    const res = await customer(placed, '1/approve', { checklist: CHECKLIST });
    expect(res.body.status).toBe('out_for_handover');
  });
});
