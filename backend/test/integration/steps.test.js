import 'dotenv/config';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addWorkingDays, nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { installDateError } from '@noorcom-branding/shared/rules/site-quote.js';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { createPool } from '../../src/db/pool.js';
import { createStorage } from '../../src/integrations/storage/index.js';
import { runJob } from '../../src/jobs/handlers/index.js';
import { createLogger } from '../../src/lib/logger.js';
import { addStaff } from '../../src/modules/staff/service.js';

/**
 * Step B5's order steps against a real Postgres (skipped without it), each run through by the API
 * alone: a big run's pre-production sample with an early delivery, a design-only order's final
 * files, and a site job from survey to sign-off.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });
const PASSWORD = 'correct horse battery';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const CHECKLIST = { spelling: true, colours: true, size: true, quantity: true, colourVariance: true };
const customer = { name: 'Amina Wanjiru', company: 'Acme Ltd', phone: '0722 530 301', email: 'amina@example.co.ke' };
const common = { colours: [], typography: 'designer', fonts: '', assets: [], inspiration: [], inspirationLinks: [], text: 'Acme', styles: [], artwork: 'need-design', notes: '' };

describe.skipIf(!dbUrl)('the rest of an order’s steps (B5)', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  const dir = mkdtempSync(join(tmpdir(), 'nb-storage-'));
  let queued, deps, app, staff;

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE price_tiers, products, categories, staff_users, provider_callbacks, c2b_confirmations RESTART IDENTITY CASCADE');
    await knex.raw('TRUNCATE orders RESTART IDENTITY CASCADE');
    await knex.raw('UPDATE counters SET value = 0');
    await knex.seed.run();
    queued = [];
    deps = { pool, redis: null, logger, config, storage: createStorage({ dir }), jobs: { enqueue: async (name, data) => void queued.push({ name, data }), schedule: async () => {}, close: async () => {} } };
    app = createApp(config, deps);
    await addStaff(deps, null, { email: 'designer@noorcombranding.co.ke', name: 'The designer', role: 'designer', password: PASSWORD });
    staff = request.agent(app);
    await staff.post('/api/staff/auth/sign-in').send({ email: 'designer@noorcombranding.co.ke', password: PASSWORD });
  });
  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    await knex?.destroy();
    await pool?.end();
  });

  const place = async (body) => {
    const res = await request(app).post('/api/orders').send({ needsDesign: true, urgency: 'standard', common, customer, ...body });
    expect(res.status).toBe(201);
    return res.body;
  };
  const view = async ({ ref, token }) => (await request(app).get(`/api/orders/${ref}`).set('x-order-token', token)).body;
  const as = ({ ref, token }, path, body = {}) => request(app).post(`/api/orders/${ref}/${path}`).set('x-order-token', token).send(body);
  const step = (ref, path, body = {}) => staff.post(`/api/staff/orders/${ref}/${path}`).set('x-requested-with', 'nb-admin').send(body);
  const upload = (ref, path, body, type, headers = {}) => staff.post(`/api/staff/orders/${ref}/${path}`).set('x-requested-with', 'nb-admin').set('content-type', type).set(headers).send(body);
  /** Pays what is due by Paybill, through the worker's handler. */
  async function payDue(placed) {
    const { dueNow } = await view(placed);
    await request(app).post('/api/dev/c2b').send({ ref: placed.ref, amount: dueNow });
    for (const job of queued.splice(0)) if (job.name === 'process-c2b') await runJob(deps, job.name, job.data);
    return view(placed);
  }
  /** Proof v1 uploaded and approved. */
  async function approveDesign(placed) {
    expect((await upload(placed.ref, 'proofs', PNG, 'image/png')).status).toBe(201);
    expect((await as(placed, 'proofs/1/approve', { checklist: CHECKLIST })).status).toBe(200);
  }

  it('runs a big order’s sample and an early delivery', async () => {
    const placed = await place({
      product: 't-shirt-printing',
      quantity: 250,
      brief: { garmentColour: 'Black', sizes: { S: 50, M: 100, L: 100, XL: 0, XXL: 0 }, positions: ['front'], method: 'screen', printColours: 1 },
      handover: { method: 'delivery', zone: 'inner', address: 'Kilimani, Nairobi' },
    });
    await payDue(placed);
    await approveDesign(placed);
    let o = await payDue(placed);
    expect(o.status).toBe('in_production');
    expect(o.sample).toEqual({ status: 'waiting', photo: null, uploadedAt: null, comments: null });

    // No run before the sample is approved.
    expect((await step(placed.ref, 'progress', { pieces: 10 })).body.message).toMatch(/approves the sample/);
    expect((await as(placed, 'sample', { decision: 'approve' })).status).toBe(409);
    expect((await upload(placed.ref, 'sample', PNG, 'image/png')).status).toBe(200);
    o = await view(placed);
    expect(o.sample).toMatchObject({ status: 'pending', photo: expect.stringMatching(/^\/api\/files\/samples\/NB-\d{6}\/[0-9a-f]{16}\.png\?exp=/) });
    expect((await request(app).get(o.sample.photo)).headers['content-type']).toBe('image/png');
    expect((await as(placed, 'sample', { decision: 'changes', comments: 'Hi' })).status).toBe(400);
    expect((await as(placed, 'sample', { decision: 'changes', comments: 'Print the logo a little higher.' })).body.sample).toMatchObject({ status: 'changes_requested', comments: 'Print the logo a little higher.' });
    await upload(placed.ref, 'sample', PNG, 'image/png');
    expect((await as(placed, 'sample', { decision: 'approve' })).body.sample.status).toBe('approved');
    expect((await step(placed.ref, 'progress', { pieces: 100 })).status).toBe(200);

    // Early delivery of 60 finished pieces: asked for, out, delivered; the rest goes as one.
    expect((await as(placed, 'deliveries', { pieces: 150 })).status).toBe(400);
    o = (await as(placed, 'deliveries', { pieces: 60 })).body;
    expect(o.deliveries).toEqual([expect.objectContaining({ pieces: 60, partial: true, status: 'requested' })]);
    expect((await as(placed, 'deliveries', { pieces: 10 })).body.message).toMatch(/already on its way/);
    expect((await step(placed.ref, 'early-delivery', {})).status).toBe(400);
    await step(placed.ref, 'early-delivery', { rider: 'Kevin Mwangi', riderPhone: '0711000201' });
    await step(placed.ref, 'early-delivery', { recipient: 'Reception' });
    await step(placed.ref, 'progress', { pieces: 150 });
    await step(placed.ref, 'ready');
    await step(placed.ref, 'dispatch', { waybill: 'WB12345678' });
    o = await view(placed);
    expect(o.deliveries.map((d) => [d.pieces, d.partial, d.status])).toEqual([
      [60, true, 'delivered'],
      [190, false, 'out'],
    ]);
    const sent = await knex('notifications').where({ template: 'sample-ready' });
    expect(sent).toHaveLength(4);
  });

  it('sends a design-only order’s final files', async () => {
    const placed = await place({ product: 'logo-package', quantity: 1, brief: { format: 'Logo', concepts: '2', files: ['pdf', 'source'] }, handover: { method: 'digital' } });
    await payDue(placed);
    expect((await upload(placed.ref, 'finals', Buffer.from('%PDF-1.4'), 'application/pdf', { 'x-file-name': 'logo.pdf' })).status).toBe(409);
    await approveDesign(placed);
    expect((await view(placed)).status).toBe('out_for_handover');

    expect((await step(placed.ref, 'finals/send')).body.message).toMatch(/Upload the final files/);
    const up = await upload(placed.ref, 'finals', Buffer.from('%PDF-1.4 logo'), 'application/pdf', { 'x-file-name': encodeURIComponent('Acme logo (final).pdf') });
    expect(up.status).toBe(200);
    await upload(placed.ref, 'finals', Buffer.from('PK zip'), 'application/zip', { 'x-file-name': 'source.zip' });
    let o = await view(placed);
    expect(o.finalFiles.map((f) => f.name)).toEqual(['Acme-logo-final-.pdf', 'source.zip']);
    const file = await request(app).get(o.finalFiles[0].url);
    expect(file.headers['content-disposition']).toBe('attachment; filename="Acme-logo-final-.pdf"');
    expect(String(file.body)).toBe('%PDF-1.4 logo');

    expect((await staff.delete(`/api/staff/orders/${placed.ref}/finals/${o.finalFiles[1].id}`).set('x-requested-with', 'nb-admin')).status).toBe(200);
    o = (await step(placed.ref, 'finals/send')).body.order;
    expect(o).toMatchObject({ status: 'completed', handedOver: { method: 'digital' } });
    expect(o.finalFiles).toHaveLength(1);
    expect((await upload(placed.ref, 'finals', Buffer.from('x'), 'application/pdf')).status).toBe(409);
  });

  it('runs a site job from the survey to sign-off and the balance', async () => {
    const today = nairobiToday(new Date());
    const placed = await place({
      product: 'indoor-branding-job',
      quantity: 1,
      brief: { siteAddress: 'Loita Street, Nairobi', space: 'reception', surfaces: ['walls', 'glass'], surveyDates: [addWorkingDays(today, 2), addWorkingDays(today, 3)] },
      handover: { method: 'install', address: 'Loita Street, Nairobi' },
    });
    let o = await payDue(placed);
    expect(o).toMatchObject({ status: 'in_design', amountPaid: 2500 });

    const quote = { items: [{ label: 'Feature wall', material: 'wallpaper', widthCm: 420, heightCm: 260, quantity: 1 }], extras: [], notes: 'Smooth plaster.' };
    expect((await step(placed.ref, 'site-quote', quote)).body.message).toMatch(/survey date/);
    expect((await as(placed, 'survey', { date: today })).status).toBe(400);
    o = (await as(placed, 'survey', { date: addWorkingDays(today, 2) })).body;
    expect(o.survey.booked).toBe(addWorkingDays(today, 2));
    expect((await step(placed.ref, 'site-quote', { ...quote, items: [{ ...quote.items[0], widthCm: 0 }] })).status).toBe(400);
    o = (await step(placed.ref, 'site-quote', quote)).body.order;
    expect(o.siteQuote).toMatchObject({ status: 'pending', total: expect.any(Number), deposit: Math.round(o.siteQuote.total / 2), surveyNotes: 'Smooth plaster.' });
    expect(o.progress.stages[0]).toEqual({ name: 'Survey', done: true });

    o = (await as(placed, 'quote/accept')).body;
    expect(o).toMatchObject({ status: 'awaiting_payment', total: o.siteQuote.total, dueNow: o.siteQuote.deposit, duePurpose: 'deposit' });
    o = await payDue(placed);
    expect(o.status).toBe('in_design');
    await approveDesign(placed);
    o = await view(placed);
    expect(o.status).toBe('in_production');

    // Stages: materials, then the installation date the customer books, installed, signed off.
    expect((await step(placed.ref, 'stage')).body.order.progress.stages.find((s) => s.name === 'Materials printed').done).toBe(true);
    expect((await step(placed.ref, 'stage')).body.message).toMatch(/installation date/);
    let date = addWorkingDays(today, 3);
    while (installDateError(date, today)) date = addWorkingDays(date, 1);
    expect((await as(placed, 'install', { date: today })).status).toBe(400);
    o = (await as(placed, 'install', { date })).body;
    expect(o.installDate).toBe(date);
    expect(o.progress.stages.find((s) => s.name === 'Installation scheduled').done).toBe(true);
    await step(placed.ref, 'stage');
    o = (await step(placed.ref, 'stage')).body.order;
    expect(o).toMatchObject({ status: 'awaiting_balance', handedOver: { method: 'install' }, duePurpose: 'balance' });
    expect(o.dueNow).toBe(o.total - o.amountPaid);
    o = await payDue(placed);
    expect(o.status).toBe('completed');
    // The survey fee came off the balance: what was paid is the quote's total.
    expect(o.amountPaid).toBe(o.total);
  });
});
