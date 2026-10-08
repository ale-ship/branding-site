import 'dotenv/config';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { orderProducts } from '@noorcom-branding/shared/catalogue/order-catalogue.js';
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { estimatePrice } from '@noorcom-branding/shared/rules/pricing.js';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { createPool } from '../../src/db/pool.js';
import { hashToken } from '../../src/lib/ids.js';
import { createLogger } from '../../src/lib/logger.js';
import { createOrder, expireUnpaid } from '../../src/modules/orders/service.js';

/**
 * Step B2 against a real Postgres (TEST_DATABASE_URL in backend/.env; skipped without it): an order
 * is priced by the server, stored with its invoice, its machine time and its messages, read back by
 * its token or by order number + phone, and expires when unpaid.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });

const common = {
  colours: ['#D71920'],
  typography: 'from-logo',
  fonts: '',
  assets: [{ name: 'logo.pdf', size: 120_000, type: 'application/pdf' }],
  inspiration: [],
  inspirationLinks: [],
  text: 'Noorcom Branding',
  styles: ['Bold'],
  artwork: 'print-ready',
  notes: '',
};

const order = (over = {}) => ({
  product: 't-shirt-printing',
  quantity: 120,
  brief: { garmentColour: 'Black', sizes: { S: 20, M: 40, L: 40, XL: 20, XXL: 0 }, positions: ['front', 'back'], method: 'screen', printColours: 2 },
  needsDesign: false,
  urgency: 'standard',
  handover: { method: 'delivery', zone: 'inner', address: 'Kilimani, Nairobi' },
  common,
  customer: { name: 'Amina Wanjiru', company: 'Acme Ltd', phone: '0722 530 301', email: 'Amina@Example.co.ke' },
  ...over,
});

describe.skipIf(!dbUrl)('orders (B2)', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  const app = createApp(config, { logger, pool, redis: null });
  const place = (body = order()) => request(app).post('/api/orders').send(body);
  const read = (ref, token) => request(app).get(`/api/orders/${ref}`).set('x-order-token', token);

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE price_tiers, products, categories RESTART IDENTITY CASCADE');
    await knex.raw('UPDATE counters SET value = 0');
    await knex.seed.run();
  });
  afterAll(async () => {
    await knex?.destroy();
    await pool?.end();
  });

  it('places an order with its invoice, machine time and messages, keeping only the token’s hash', async () => {
    const res = await place();
    expect(res.status).toBe(201);
    expect(res.body.ref).toMatch(/^NB-\d{6}$/);
    expect(res.body.token).toMatch(/^[0-9a-f]{32}$/);

    const row = await knex('orders').where({ order_no: res.body.ref }).first();
    expect(row.token_hash).toBe(hashToken(res.body.token));
    expect(JSON.stringify(row)).not.toContain(res.body.token);
    expect(row).toMatchObject({ status: 'awaiting_payment', customer_phone: '+254722530301', customer_email: 'amina@example.co.ke', quantity: 120 });

    const invoice = await knex('invoices').where({ order_id: row.id }).first();
    expect(invoice.invoice_no).toBe('INV00001');
    expect(invoice.total).toBe(row.total);
    expect(invoice.lines).toEqual(row.estimate.lines);

    const booked = await knex('capacity_bookings').where({ order_id: row.id });
    expect(booked.length).toBeGreaterThan(0);
    expect(booked.every((b) => b.machine === 'screen-press')).toBe(true);
    expect(booked.reduce((n, b) => n + b.units, 0)).toBe(120);

    const messages = await knex('notifications').where({ order_id: row.id }).orderBy('id');
    expect(messages.map((m) => [m.channel, m.recipient, m.template, m.status])).toEqual([
      ['whatsapp', '+254722530301', 'order-placed', 'pending'],
      ['email', 'amina@example.co.ke', 'order-placed', 'pending'],
    ]);
    expect(messages[0].payload.text).toBe(`Thank you, Amina. Order ${res.body.ref} is placed: pay KES ${row.due_now.toLocaleString('en-KE')} to start.`);
  });

  it('numbers invoices one after another', async () => {
    const a = await place();
    const b = await place();
    const numbers = await knex('invoices').join('orders', 'orders.id', 'invoices.order_id').whereIn('order_no', [a.body.ref, b.body.ref]).orderBy('invoices.id').pluck('invoice_no');
    expect(numbers).toEqual(['INV00001', 'INV00002']);
  });

  it('prices on the server and ignores any price the browser sends', async () => {
    const res = await place({ ...order(), total: 1, estimate: { total: 1 } });
    const got = await read(res.body.ref, res.body.token);
    expect(got.status).toBe(200);
    const product = orderProducts.find((p) => p.slug === 't-shirt-printing');
    const today = nairobiToday();
    // The order itself is on the calendar now; price against the calendar as it was before it.
    expect(got.body.estimate).toEqual(estimatePrice(product, order(), today, {}));
    expect(got.body.total).toBe(got.body.estimate.total);
    expect(got.body.dueNow).toBe(got.body.estimate.dueNow.amount);
  });

  it('reads the order back by its token in the contract’s shape', async () => {
    const { body } = await place();
    const res = await read(body.ref, body.token);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({
      ref: body.ref,
      invoiceNo: 'INV00001',
      status: 'awaiting_payment',
      mechanism: 'A',
      product: { slug: 't-shirt-printing', category: 'apparel' },
      customer: { name: 'Amina Wanjiru', company: 'Acme Ltd', phone: '+254722530301', email: 'amina@example.co.ke' },
      amountPaid: 0,
      credit: 0,
      payments: [],
      proofs: [],
      progress: { kind: 'pieces', done: 0, total: 120 },
      sample: null,
      company: null,
    });
    expect(res.body.events.map((e) => e.text)).toEqual(['Order placed.']);
    expect(res.body.notifications.map((n) => n.channel)).toEqual(['whatsapp', 'email']);
    expect(Date.parse(res.body.expiresAt) - Date.parse(res.body.createdAt)).toBe(48 * 3_600_000);
    expect(res.body).not.toHaveProperty('token');
    expect(res.body).not.toHaveProperty('token_hash');
  });

  it('answers the same 404 for a wrong token, no token and an unknown order', async () => {
    const { body } = await place();
    const wrong = await read(body.ref, 'f'.repeat(32));
    const none = await request(app).get(`/api/orders/${body.ref}`);
    const unknown = await read('NB-000000', body.token);
    for (const res of [wrong, none, unknown]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'not_found', message: 'We couldn’t find that order.' });
    }
  });

  it('finds an order by its number and the phone it was placed with, however the phone is typed', async () => {
    const { body } = await place();
    for (const phone of ['0722530301', '+254 722 530 301', '722530301']) {
      const res = await request(app).post('/api/orders/lookup').send({ ref: body.ref.toLowerCase(), phone });
      expect(res.status).toBe(200);
      expect(res.body.ref).toBe(body.ref);
    }
    const wrong = await request(app).post('/api/orders/lookup').send({ ref: body.ref, phone: '0711000000' });
    expect(wrong.status).toBe(404);
    const malformed = await request(app).post('/api/orders/lookup').send({ ref: 'NB-12', phone: '0722530301' });
    expect(malformed.status).toBe(400);
  });

  it('refuses what the order rules don’t allow, with a message for the customer', async () => {
    const cases = [
      [order({ quantity: 5 }), /smallest order/],
      [order({ customer: { ...order().customer, phone: '12345' } }), /Kenyan mobile number/],
      [order({ customer: { ...order().customer, email: 'not-an-email' } }), /valid email/],
      [order({ handover: { method: 'digital' } }), /way of receiving/],
      [order({ handover: { method: 'delivery', zone: 'inner', address: '' } }), /delivery address/],
      [order({ brief: { ...order().brief, garmentColour: '' } }), /Please answer/],
      [order({ product: 'no-such-thing' }), /can’t be ordered online/],
    ];
    for (const [body, message] of cases) {
      const res = await place(body);
      expect(res.status, JSON.stringify(res.body)).toBe(400);
      expect(res.body.message).toMatch(message);
    }
    expect(await knex('orders').count({ n: '*' }).first()).toEqual({ n: '0' });
  });

  it('refuses a malformed body with the fields at fault', async () => {
    const res = await place({ ...order(), customer: { name: '' }, quantity: 'lots' });
    expect(res.status).toBe(400);
    const paths = res.body.details.fields.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(['quantity', 'customer.name']));
  });

  it('expires an unpaid order after 48 hours and lets go of its machine time', async () => {
    const placedAt = new Date(Date.now() - 49 * 3_600_000);
    const { ref, token } = await createOrder({ pool, redis: null, logger }, order(), placedAt);
    expect(Number((await knex('capacity_bookings').count({ n: '*' }).first()).n)).toBeGreaterThan(0);

    const res = await read(ref, token);
    expect(res.body).toMatchObject({ status: 'expired', dueNow: 0, duePurpose: null });
    expect(res.body.events.at(-1).text).toBe('Not paid within 48 hours, so the order has expired.');
    expect(await knex('capacity_bookings').count({ n: '*' }).first()).toEqual({ n: '0' });

    // Reading it again changes nothing, and the sweep finds nothing left to expire.
    const again = await read(ref, token);
    expect(again.body.events).toHaveLength(2);
    expect(await expireUnpaid({ pool })).toBe(0);
  });

  it('sweeps unpaid orders nobody opened, and leaves younger ones alone', async () => {
    const deps = { pool, redis: null, logger };
    await createOrder(deps, order(), new Date(Date.now() - 50 * 3_600_000));
    await createOrder(deps, order(), new Date(Date.now() - 49 * 3_600_000));
    await createOrder(deps, order());
    expect(await expireUnpaid({ pool })).toBe(2);
    expect(await knex('orders').where({ status: 'awaiting_payment' }).count({ n: '*' }).first()).toEqual({ n: '1' });
  });

  it('serves the capacity calendar, and prices the next order against it', async () => {
    const { body } = await place(order({ quantity: 2000, urgency: 'economy' }));
    expect(body.ref).toBeDefined();
    const cal = await request(app).get('/api/capacity');
    expect(cal.status).toBe(200);
    const units = Object.values(cal.body['screen-press']).reduce((n, u) => n + u, 0);
    expect(units).toBe(2000);

    const price = await request(app).post('/api/quotes/price').send({ ...order(), common: undefined, customer: undefined });
    const product = orderProducts.find((p) => p.slug === 't-shirt-printing');
    expect(price.body).toEqual(estimatePrice(product, order(), nairobiToday(), cal.body));
  });

  it('answers 503 without a database', async () => {
    const bare = createApp(config, { logger, pool: null, redis: null });
    expect((await request(bare).post('/api/orders').send(order())).status).toBe(503);
    expect((await request(bare).get('/api/capacity')).status).toBe(503);
  });
});
