import 'dotenv/config';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { createPool } from '../../src/db/pool.js';
import { createStorage } from '../../src/integrations/storage/index.js';
import { createWhatsApp } from '../../src/integrations/whatsapp/index.js';
import { createLogger } from '../../src/lib/logger.js';
import { sendNotification } from '../../src/modules/notifications/service.js';
import { addStaff } from '../../src/modules/staff/service.js';

/**
 * Payments by hand (owner, 21 Oct 2026) against a real Postgres (skipped without it): no M-Pesa
 * prompt; the customer pays to the Paybill and reports their code; a designer records the payment,
 * which moves the order like a confirmed M-Pesa payment, and the admin sees who did it.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test', STAFF_INBOX: 'inbox@noorcombranding.co.ke' });
const logger = createLogger({ env: 'test' });
const PASSWORD = 'correct horse battery';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const CHECKLIST = { spelling: true, colours: true, size: true, quantity: true, colourVariance: true };
const customer = { name: 'Amina Wanjiru', company: 'Acme Ltd', phone: '0722 530 301', email: 'amina@example.co.ke' };
const common = { colours: [], typography: 'designer', fonts: '', assets: [], inspiration: [], inspirationLinks: [], text: 'Acme', styles: [], artwork: 'need-design', notes: '' };
const tshirts = {
  product: 't-shirt-printing',
  quantity: 120,
  brief: { garmentColour: 'Black', sizes: { S: 20, M: 40, L: 40, XL: 20, XXL: 0 }, positions: ['front'], method: 'screen', printColours: 1 },
  needsDesign: true,
  urgency: 'standard',
  handover: { method: 'pickup' },
  common,
  customer,
};

describe.skipIf(!dbUrl)('payments recorded by hand', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  const dir = mkdtempSync(join(tmpdir(), 'nb-storage-'));
  let deps, app, designer, admin;

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE price_tiers, products, categories, staff_users, provider_callbacks, c2b_confirmations RESTART IDENTITY CASCADE');
    await knex.raw('TRUNCATE orders RESTART IDENTITY CASCADE');
    await knex.raw('UPDATE counters SET value = 0');
    await knex.seed.run();
    deps = { pool, redis: null, logger, config, storage: createStorage({ dir }), jobs: { enqueue: async () => {}, schedule: async () => {}, close: async () => {} } };
    app = createApp(config, deps);
    await addStaff(deps, null, { email: 'admin@noorcombranding.co.ke', name: 'The owner', role: 'admin', password: PASSWORD });
    await addStaff(deps, null, { email: 'wanjiku@noorcombranding.co.ke', name: 'Wanjiku', role: 'designer', password: PASSWORD });
    designer = request.agent(app);
    await designer.post('/api/staff/auth/sign-in').send({ email: 'wanjiku@noorcombranding.co.ke', password: PASSWORD });
    admin = request.agent(app);
    await admin.post('/api/staff/auth/sign-in').send({ email: 'admin@noorcombranding.co.ke', password: PASSWORD });
  });
  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    await knex?.destroy();
    await pool?.end();
  });

  const place = async () => (await request(app).post('/api/orders').send(tshirts)).body;
  const view = async ({ ref, token }) => (await request(app).get(`/api/orders/${ref}`).set('x-order-token', token)).body;
  const report = ({ ref, token }, body) => request(app).post(`/api/orders/${ref}/payment-report`).set('x-order-token', token).send(body);
  const pay = (ref, body) => designer.post(`/api/staff/orders/${ref}/payments`).set('x-requested-with', 'nb-admin').send({ paidOn: nairobiToday(new Date()), ...body });
  const messages = async (ref) =>
    (await knex('notifications').join('orders', 'orders.id', 'notifications.order_id').where('orders.order_no', ref).orderBy('notifications.id')).map((n) => [n.channel, n.recipient, n.template]);

  it('takes the deposit by hand: the customer reports their code, a designer records it, the order starts', async () => {
    const placed = await place();
    let o = await view(placed);
    expect(o).toMatchObject({ status: 'awaiting_payment', duePurpose: 'deposit', paymentReport: null });
    expect(Date.parse(o.expiresAt) - Date.parse(o.createdAt)).toBe(7 * 24 * 3_600_000);

    // No M-Pesa prompt while payments are manual.
    const stk = await request(app).post('/api/payments/stk').set('x-order-token', placed.token).send({ ref: placed.ref, phone: '0722530301' });
    expect(stk.status).toBe(409);
    expect(stk.body.message).toMatch(/Paybill/);

    // The customer says they've paid; the order is flagged, not moved.
    expect((await report(placed, { code: 'abc' })).status).toBe(400);
    const reported = await report(placed, { code: 'tjk4 xy12ab', amount: o.dueNow });
    expect(reported.status).toBe(200);
    expect(reported.body).toMatchObject({ status: 'awaiting_payment', paymentReport: { code: 'TJK4XY12AB', amount: o.dueNow } });
    expect(reported.body.events.at(-1).text).toBe(`You told us you paid KES ${o.dueNow.toLocaleString('en-KE')} (reference TJK4XY12AB). We’re checking it.`);
    expect((await report(placed, { code: 'TJK4XY12AB' })).status).toBe(409);
    expect(await messages(placed.ref)).toEqual(
      expect.arrayContaining([
        ['whatsapp', '+254722530301', 'payment-reported'],
        ['email', 'amina@example.co.ke', 'payment-reported'],
        ['email', 'inbox@noorcombranding.co.ke', 'payment-check'],
      ]),
    );
    let staffView = (await designer.get(`/api/staff/orders/${placed.ref}`)).body;
    expect(staffView.staff.attention).toBe('payment-reported');
    expect((await designer.get('/api/staff/dashboard')).body.attention).toBe(1);

    // A designer records it: the same as a confirmed M-Pesa payment.
    expect((await pay(placed.ref, { amount: o.dueNow, channel: 'mpesa', reference: 'TJK4' })).status).toBe(400);
    expect((await pay(placed.ref, { amount: o.dueNow, channel: 'mpesa', reference: 'TJK4XY12AB', paidOn: '2099-01-01' })).status).toBe(400);
    const recorded = await pay(placed.ref, { amount: o.dueNow, channel: 'mpesa', reference: 'TJK4XY12AB' });
    expect(recorded.status).toBe(200);
    expect(recorded.body.staff.attention).toBeNull();
    expect(recorded.body.order).toMatchObject({ status: 'in_design', amountPaid: o.dueNow, dueNow: 0, expiresAt: null, paymentReport: null });
    expect(recorded.body.order.payments).toEqual([
      expect.objectContaining({ method: 'manual', channel: 'mpesa', status: 'confirmed', amount: o.dueNow, mpesaReceipt: 'TJK4XY12AB', receiptNo: 'RCT00001' }),
    ]);
    const row = await knex('payments').first();
    expect(row).toMatchObject({ method: 'manual', channel: 'mpesa', recorded_by: 2 });
    expect(await messages(placed.ref)).toEqual(expect.arrayContaining([['email', 'amina@example.co.ke', 'payment-received']]));

    // The same code can never be recorded twice.
    const again = await pay(placed.ref, { amount: 100, channel: 'mpesa', reference: 'TJK4XY12AB' });
    expect(again.status).toBe(409);
    expect(again.body.message).toBe(`That M-Pesa reference is already recorded, on ${placed.ref}.`);

    // The admin sees who did it; a designer can't open the Activity page.
    expect((await designer.get('/api/staff/activity')).status).toBe(403);
    const activity = (await admin.get('/api/staff/activity')).body;
    expect(activity.entries[0]).toMatchObject({
      staff: 'Wanjiku',
      role: 'designer',
      action: 'payment-recorded',
      order: placed.ref,
      detail: { amount: o.dueNow, channel: 'mpesa', reference: 'TJK4XY12AB', receiptNo: 'RCT00001' },
    });
    // One person's actions, sign-ins included.
    const hers = (await admin.get('/api/staff/activity?staff=2')).body.entries;
    expect(hers.map((e) => e.action)).toEqual(['payment-recorded', 'sign-in']);
    expect(new Set(hers.map((e) => e.staff))).toEqual(new Set(['Wanjiku']));
  });

  it('takes the balance by bank and cash, and tells the customer when a reported code isn’t found', async () => {
    const placed = await place();
    let o = await view(placed);
    await pay(placed.ref, { amount: o.dueNow, channel: 'cash' });
    expect((await designer.post(`/api/staff/orders/${placed.ref}/proofs`).set('x-requested-with', 'nb-admin').set('content-type', 'image/png').send(PNG)).status).toBe(201);
    expect((await request(app).post(`/api/orders/${placed.ref}/proofs/1/approve`).set('x-order-token', placed.token).send({ checklist: CHECKLIST })).status).toBe(200);
    o = await view(placed);
    expect(o).toMatchObject({ status: 'awaiting_balance', duePurpose: 'balance' });

    // A code staff can't find: dismissed, and the customer is asked to check it.
    await report(placed, { code: 'ZZZ9ZZZ9ZZ' });
    const dismissed = await designer.post(`/api/staff/orders/${placed.ref}/attention/clear`).set('x-requested-with', 'nb-admin').send({});
    expect(dismissed.body.order.paymentReport).toBeNull();
    expect(dismissed.body.order.events.at(-1).text).toBe('We couldn’t find a payment with reference ZZZ9ZZZ9ZZ. Please check the code, or WhatsApp us.');
    expect(await messages(placed.ref)).toEqual(expect.arrayContaining([['email', 'amina@example.co.ke', 'payment-not-found']]));

    // Part by bank, the rest in cash: production starts only when it's all in.
    const part = await pay(placed.ref, { amount: 1000, channel: 'bank', reference: 'ft2611 0045' });
    expect(part.body.order).toMatchObject({ status: 'awaiting_balance', dueNow: o.dueNow - 1000 });
    expect(part.body.order.payments.at(-1)).toMatchObject({ channel: 'bank', mpesaReceipt: 'BANK-FT26110045' });
    const rest = await pay(placed.ref, { amount: o.dueNow - 1000, channel: 'cash' });
    expect(rest.body.order).toMatchObject({ status: 'in_production', dueNow: 0 });
    expect(rest.body.order.payments.map((p) => p.receiptNo)).toEqual(['RCT00001', 'RCT00002', 'RCT00003']);
  });

  it('skips WhatsApp when it is off: the customer gets the email, and the order shows only what was sent', async () => {
    const placed = await place();
    const off = { ...deps, whatsapp: createWhatsApp({ mode: 'off', outboxDir: dir }), mailer: { send: async () => {} } };
    const ids = (await knex('notifications').orderBy('id')).map((n) => [n.id, n.channel]);
    expect(ids.map(([, c]) => c)).toEqual(['whatsapp', 'email']);
    for (const [id, channel] of ids) expect(await sendNotification(off, id)).toBe(channel === 'whatsapp' ? 'skipped' : 'sent');
    expect((await knex('notifications').orderBy('id')).map((n) => n.status)).toEqual(['skipped', 'sent']);
    expect((await view(placed)).notifications.map((n) => n.channel)).toEqual(['email']);
  });
});
