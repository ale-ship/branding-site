import 'dotenv/config';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { createPool, withTransaction } from '../../src/db/pool.js';
import { createFakeAbsa } from '../../src/integrations/absa/fake.js';
import { createMailer } from '../../src/integrations/mailer/index.js';
import { createWhatsApp } from '../../src/integrations/whatsapp/index.js';
import { runJob } from '../../src/jobs/handlers/index.js';
import { createLogger } from '../../src/lib/logger.js';
import { assignUnmatched, listUnmatched, markForRefund } from '../../src/modules/payments/c2b.service.js';
import { record } from '../../src/modules/payments/ledger.js';
import { queryStk } from '../../src/modules/payments/service.js';

/**
 * Step B3 against a real Postgres (TEST_DATABASE_URL; skipped without it): M-Pesa prompts answered
 * by the fake Absa through the real callback route, Paybill payments routed and recorded, the ledger,
 * receipts, and the messages sent. Jobs are recorded and run here by `drain()`, with the same
 * handlers the worker uses; a Map stands in for Redis.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });
const SECRET = config.absa.secret;

/** The few Redis commands used here: SET (EX, NX), GET, DEL, and the rate limiter's EVAL. */
function fakeRedis() {
  const store = new Map();
  return {
    store,
    get: async (k) => store.get(k) ?? null,
    set: async (k, v, ...args) => (args.includes('NX') && store.has(k) ? null : (store.set(k, v), 'OK')),
    del: async (k) => Number(store.delete(k)),
    eval: async () => [1, 60],
  };
}

const placeBody = (over = {}) => ({
  product: 'poster-design',
  quantity: 1,
  brief: { format: 'A3 poster', concepts: '1', files: ['pdf'] },
  needsDesign: true,
  urgency: 'standard',
  handover: { method: 'digital' },
  common: { colours: [], typography: 'designer', fonts: '', assets: [], inspiration: [], inspirationLinks: [], text: 'Sale', styles: [], artwork: 'need-design', notes: '' },
  customer: { name: 'Amina Otieno', company: '', phone: '0722 530 303', email: 'amina@example.co.ke' },
  ...over,
});

describe.skipIf(!dbUrl)('payments (B3)', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  const outbox = mkdtempSync(join(tmpdir(), 'nb-outbox-'));
  /** @type {{ name: string; data: any; options: any }[]} */
  let queued;
  /** @type {unknown[]} */
  let delivered;
  let deps;
  let app;

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE price_tiers, products, categories, provider_callbacks, c2b_confirmations RESTART IDENTITY CASCADE');
    await knex.raw('UPDATE counters SET value = 0');
    await knex.seed.run();
    rmSync(outbox, { recursive: true, force: true });
    queued = [];
    delivered = [];
    const redis = fakeRedis();
    deps = {
      pool,
      redis,
      logger,
      config,
      jobs: { enqueue: async (name, data, options) => void queued.push({ name, data, options }), schedule: async () => {}, close: async () => {} },
      absa: createFakeAbsa({ redis, delayMs: 0, deliver: async (body) => void delivered.push(body) }),
      whatsapp: createWhatsApp({ outboxDir: join(outbox, 'whatsapp') }),
      mailer: createMailer({ from: 'Noorcom Branding <info@noorcombranding.co.ke>', outboxDir: join(outbox, 'mail'), smtp: null }),
    };
    app = createApp(config, deps);
  });
  afterAll(async () => {
    rmSync(outbox, { recursive: true, force: true });
    await knex?.destroy();
    await pool?.end();
  });

  /** Runs every queued job (not the delayed status queries) until none are left. */
  async function drain() {
    const results = [];
    for (let job = queued.shift(); job; job = queued.shift()) {
      if (job.name === 'stk-query') continue;
      results.push(await runJob(deps, job.name, job.data));
    }
    return results;
  }
  /** Lets the fake Absa's timer fire, then posts what it sent to our callback route. */
  async function deliverCallbacks() {
    await new Promise((r) => setTimeout(r, 20));
    for (const body of delivered.splice(0)) {
      const res = await request(app).post(`/api/payments/absa/stk/${SECRET}`).send(body);
      expect(res.body).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
  }
  const place = async (over) => (await request(app).post('/api/orders').send(placeBody(over))).body;
  const read = async ({ ref, token }) => (await request(app).get(`/api/orders/${ref}`).set('x-order-token', token)).body;
  const pay = ({ ref, token }, phone = '0722 530 303') => request(app).post('/api/payments/stk').set('x-order-token', token).send({ ref, phone });

  it('takes an M-Pesa payment end to end: prompt, callback, ledger, receipt, messages', async () => {
    const placed = await place();
    const due = (await read(placed)).dueNow;
    expect(due).toBeGreaterThan(0);

    const res = await pay(placed);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ method: 'stk', status: 'pending', amount: due, phone: '+254722530303', receiptNo: null });
    // A second tap returns the prompt already on its way.
    expect((await pay(placed)).body.id).toBe(res.body.id);
    expect(queued.some((j) => j.name === 'stk-query' && j.options.delayMs === 65_000)).toBe(true);

    await deliverCallbacks();
    expect(await knex('provider_callbacks').count({ n: '*' }).first()).toEqual({ n: '1' });
    const results = await drain();
    expect(results).toContain('paid RCT00001');

    const order = await read(placed);
    expect(order).toMatchObject({ status: 'in_design', amountPaid: due, dueNow: 0, duePurpose: null, expiresAt: null });
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0]).toMatchObject({ id: res.body.id, status: 'confirmed', receiptNo: 'RCT00001', amount: due });
    expect(order.payments[0].mpesaReceipt).toMatch(/^[A-Z0-9]{10}$/);
    expect(order.events.map((e) => e.text)).toEqual(['Order placed.', 'Paid in full. A designer is on your brief.']);

    // Every message went out: "order placed" and "payment received", on WhatsApp and by email.
    const sent = await knex('notifications').orderBy('id').select('template', 'channel', 'status');
    expect(sent).toEqual([
      { template: 'order-placed', channel: 'whatsapp', status: 'sent' },
      { template: 'order-placed', channel: 'email', status: 'sent' },
      { template: 'payment-received', channel: 'whatsapp', status: 'sent' },
      { template: 'payment-received', channel: 'email', status: 'sent' },
    ]);
    const mails = readdirSync(join(outbox, 'mail'));
    expect(mails).toHaveLength(2);
    const eml = mails.map((f) => readFileSync(join(outbox, 'mail', f), 'utf8')).join('\n');
    expect(eml).toContain(`Subject: Payment received for ${placed.ref}, receipt RCT00001`);
    expect(eml).toContain('To: amina@example.co.ke');
    const wa = readdirSync(join(outbox, 'whatsapp')).map((f) => JSON.parse(readFileSync(join(outbox, 'whatsapp', f), 'utf8')));
    expect(wa.map((m) => m.to)).toEqual(['+254722530303', '+254722530303']);

    // Nothing is due any more.
    expect((await pay(placed)).status).toBe(409);
  });

  it('credits a repeated callback only once', async () => {
    const placed = await place();
    await pay(placed);
    await new Promise((r) => setTimeout(r, 20));
    const body = delivered[0];
    for (let i = 0; i < 3; i++) await request(app).post(`/api/payments/absa/stk/${SECRET}`).send(body);
    delivered.length = 0;
    const results = await drain();
    expect(results.filter((r) => typeof r === 'string' && r.startsWith('paid'))).toHaveLength(1);
    expect(await knex('payments').count({ n: '*' }).first()).toEqual({ n: '1' });
    expect((await knex('counters').where({ name: 'receipt' }).first()).value).toBe(1);
  });

  it('records the same M-Pesa receipt once even when two arrive at the same moment', async () => {
    const placed = await place();
    const { id } = await knex('orders').where({ order_no: placed.ref }).first();
    const money = { orderId: id, method: 'paybill', phone: null, amount: 100, mpesaReceipt: 'SAMERCPT01' };
    const both = await Promise.allSettled([withTransaction(pool, (t) => record(t, money)), withTransaction(pool, (t) => record(t, money))]);
    const recorded = both.filter((r) => r.status === 'fulfilled' && r.value.recorded);
    expect(recorded).toHaveLength(1);
    expect(await knex('payments').count({ n: '*' }).first()).toEqual({ n: '1' });
  });

  it('closes a cancelled or declined prompt with the reason, and the order waits', async () => {
    const placed = await place();
    await pay(placed, '0711 000 000');
    await deliverCallbacks();
    await drain();
    let order = await read(placed);
    expect(order.status).toBe('awaiting_payment');
    expect(order.payments[0]).toMatchObject({ status: 'cancelled', message: 'The request was cancelled on the phone.' });

    // A new prompt can go out now; this one is declined.
    expect((await pay(placed, '0711 000 002')).body.status).toBe('pending');
    await deliverCallbacks();
    await drain();
    order = await read(placed);
    expect(order.payments.map((p) => p.status)).toEqual(['cancelled', 'failed']);
  });

  it('asks Absa about a prompt nobody answered, then times it out', async () => {
    const placed = await place();
    const res = await pay(placed, '0711 000 001');
    await deliverCallbacks();
    const { id } = await knex('payment_requests').where({ public_id: res.body.id }).first();
    expect(await queryStk(deps, id, new Date(Date.now() + 10_000))).toBe('still-waiting');
    expect(await queryStk(deps, id, new Date(Date.now() + 61_000))).toBe('timeout');
    const order = await read(placed);
    expect(order.payments[0]).toMatchObject({ status: 'timeout', message: 'No answer on the phone within a minute.' });
  });

  it('settles a paid prompt from the status query when the callback never came', async () => {
    const placed = await place();
    const res = await pay(placed);
    delivered.length = 0; // the callback is lost
    await new Promise((r) => setTimeout(r, 20));
    delivered.length = 0;
    const { id } = await knex('payment_requests').where({ public_id: res.body.id }).first();
    expect(await queryStk(deps, id)).toBe('paid RCT00001');
    expect((await read(placed)).status).toBe('in_design');
  });

  it('refuses a wrong callback secret and stores nothing', async () => {
    const res = await request(app).post('/api/payments/absa/stk/not-the-secret').send({ Body: {} });
    expect(res.status).toBe(404);
    expect(await knex('provider_callbacks').count({ n: '*' }).first()).toEqual({ n: '0' });
  });

  it('keeps a callback it can’t read, for staff', async () => {
    await request(app).post(`/api/payments/absa/stk/${SECRET}`).send({ something: 'else' });
    expect(await drain()).toEqual(['unreadable']);
  });

  it('needs the order’s access, and Redis, to send a prompt', async () => {
    const placed = await place();
    expect((await pay({ ...placed, token: 'f'.repeat(32) })).status).toBe(404);
    const phoneAccess = await request(app).post('/api/payments/stk').set('x-order-phone', '0722530303').send({ ref: placed.ref, phone: '0722530303' });
    expect(phoneAccess.status).toBe(200);
    const bare = createApp(config, { ...deps, redis: null, jobs: null });
    const res = await request(bare).post('/api/payments/stk').set('x-order-token', placed.token).send({ ref: placed.ref, phone: '0722530303' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('try_again');
  });

  it('routes a Paybill payment by the order number in the account reference', async () => {
    const placed = await place();
    const due = (await read(placed)).dueNow;
    const res = await request(app).post('/api/dev/c2b').send({ ref: placed.ref, amount: due });
    expect(res.status).toBe(201);
    expect(await drain()).toContain('recorded RCT00001');
    const order = await read(placed);
    expect(order.status).toBe('in_design');
    expect(order.payments[0]).toMatchObject({ method: 'paybill', status: 'confirmed', receiptNo: 'RCT00001', amount: due });
    expect((await knex('c2b_confirmations').first()).routed_by).toBe('reference');
  });

  it('drops a repeated Paybill confirmation', async () => {
    const placed = await place();
    const body = { TransID: 'RPT0000001', TransAmount: '500', BillRefNumber: `2055268420#${placed.ref}`, BusinessShortCode: '303030', MSISDN: '254722530303', TransTime: '20261008120000' };
    for (let i = 0; i < 2; i++) expect((await request(app).post(`/api/payments/absa/c2b/confirm/${SECRET}`).send(body)).status).toBe(200);
    expect(await knex('c2b_confirmations').count({ n: '*' }).first()).toEqual({ n: '1' });
    await drain();
    expect((await read(placed)).amountPaid).toBe(500);
  });

  it('matches a Paybill payment without a reference by phone and exact amount', async () => {
    const placed = await place();
    const due = (await read(placed)).dueNow;
    await request(app).post('/api/dev/c2b').send({ billRef: 'poster', phone: '254722530303', amount: due });
    expect(await drain()).toContain('recorded RCT00001');
    expect((await knex('c2b_confirmations').first()).routed_by).toBe('phone-and-amount');
  });

  it('keeps an unmatched Paybill payment for staff, who assign it or mark it for a refund', async () => {
    const placed = await place();
    await request(app).post('/api/dev/c2b').send({ ref: 'NB-000001', amount: 1000 });
    await request(app).post('/api/dev/c2b').send({ billRef: 'who knows', amount: 77 });
    expect((await drain()).filter((r) => r !== 'sent')).toEqual(['unmatched unknown-order', 'unmatched no-match']);
    const waiting = await listUnmatched(deps);
    expect(waiting.map((w) => w.reason)).toEqual(['unknown-order', 'no-match']);

    expect(await assignUnmatched(deps, waiting[0].id, placed.ref, 'staff:test')).toBe('assigned RCT00001');
    await markForRefund(deps, waiting[1].id, 'staff:test');
    expect(await listUnmatched(deps)).toEqual([]);
    expect((await read(placed)).amountPaid).toBe(1000);
    await expect(assignUnmatched(deps, waiting[0].id, placed.ref, 'staff:test')).rejects.toThrow(/not waiting/);
  });

  it('keeps a part payment, then moves on when the rest arrives', async () => {
    const placed = await place();
    const due = (await read(placed)).dueNow;
    await request(app).post('/api/dev/c2b').send({ ref: placed.ref, amount: 1000 });
    await drain();
    let order = await read(placed);
    expect(order).toMatchObject({ status: 'awaiting_payment', amountPaid: 1000, dueNow: due - 1000 });
    await request(app).post('/api/dev/c2b').send({ ref: placed.ref, amount: due - 1000 + 250 });
    await drain();
    order = await read(placed);
    expect(order).toMatchObject({ status: 'in_design', amountPaid: due + 250, credit: 250, dueNow: 0 });
    expect(order.payments.map((p) => p.receiptNo)).toEqual(['RCT00001', 'RCT00002']);
  });

  it('keeps money for an expired order as credit and flags it for staff', async () => {
    const placed = await place();
    await knex('orders').where({ order_no: placed.ref }).update({ expires_at: new Date(Date.now() - 1000) });
    await read(placed); // expires it
    await request(app).post('/api/dev/c2b').send({ ref: placed.ref, amount: 3500 });
    await drain();
    const order = await read(placed);
    expect(order).toMatchObject({ status: 'expired', amountPaid: 3500, credit: 3500 });
    expect((await knex('orders').where({ order_no: placed.ref }).first()).attention).toBe('paid-after-close');
  });

  it('sweeps messages left waiting into the queue', async () => {
    await place();
    queued.length = 0;
    await knex('notifications').update({ created_at: new Date(Date.now() - 5 * 60_000) });
    expect(await runJob(deps, 'outbox-sweep', {})).toBe(2);
    expect(queued.map((j) => j.options.jobId)).toEqual(['notify-1', 'notify-2']);
  });
});
