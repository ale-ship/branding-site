import 'dotenv/config';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { createPool, withTransaction } from '../../src/db/pool.js';
import { createLogger } from '../../src/lib/logger.js';
import { record } from '../../src/modules/payments/ledger.js';
import { addStaff } from '../../src/modules/staff/service.js';
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';

/**
 * The admin's reports and customer accounts, against a real Postgres (TEST_DATABASE_URL; skipped
 * without it): each report's figures, the PDF and CSV downloads, statements with a balance brought
 * forward, and that only the admin sees any of it.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });
const PASSWORD = 'correct horse battery';

const order = (customer = {}, over = {}) => ({
  product: 't-shirt-printing',
  quantity: 120,
  brief: { garmentColour: 'Black', sizes: { S: 20, M: 40, L: 40, XL: 20, XXL: 0 }, positions: ['front'], method: 'screen', printColours: 1 },
  needsDesign: false,
  urgency: 'standard',
  handover: { method: 'pickup' },
  common: { colours: [], typography: 'from-logo', fonts: '', assets: [], inspiration: [], inspirationLinks: [], text: 'Noorcom', styles: [], artwork: 'print-ready', notes: '' },
  customer: { name: 'Amina Wanjiru', company: 'Acme Ltd', phone: '0722 530 301', email: 'amina@example.co.ke', ...customer },
  ...over,
});

describe.skipIf(!dbUrl)('reports and customer accounts', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  let app;
  const as = {};
  const today = nairobiToday();
  const monthStart = `${today.slice(0, 8)}01`;

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE price_tiers, products, categories, staff_users, provider_callbacks, c2b_confirmations RESTART IDENTITY CASCADE');
    await knex.raw('UPDATE counters SET value = 0');
    await knex.seed.run();
    const deps = { pool, redis: null, logger, config, jobs: { enqueue: async () => {}, schedule: async () => {}, close: async () => {} } };
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

  const place = async (customer, over) => {
    const res = await request(app).post('/api/orders').send(order(customer, over));
    expect(res.status).toBe(201);
    return knex('orders').where({ order_no: res.body.ref }).first();
  };
  const pay = (o, amount, ref) => withTransaction(pool, (t) => record(t, { orderId: o.id, method: 'paybill', phone: null, amount, mpesaReceipt: ref }));
  const get = (path) => as.admin.get(`/api/staff${path}`);

  it('is for the admin only', async () => {
    for (const path of ['/reports/sales', '/accounts', '/accounts/statement?email=amina@example.co.ke']) {
      expect((await as.designer.get(`/api/staff${path}`)).status).toBe(403);
      expect((await request(app).get(`/api/staff${path}`)).status).toBe(401);
    }
  });

  it('reports sales, payments, money owed and sales by product', async () => {
    const a = await place();
    const b = await place({ name: 'Brian Otieno', company: '', email: 'brian@example.co.ke', phone: '0711 000 222' });
    const gone = await place({ name: 'Never Paid', company: '', email: 'never@example.co.ke', phone: '0711 000 333' });
    await knex('orders').where({ id: gone.id }).update({ status: 'expired' });
    await pay(a, a.total, 'REP0000001');
    await pay(b, 1000, 'REP0000002');
    await knex('orders').where({ id: b.id }).update({ status: 'in_production' });

    const sales = (await get('/reports/sales')).body.report;
    expect(sales.period).toEqual({ from: monthStart, to: today });
    expect(sales.rows.map((r) => [r.order, r.invoiced, r.paid, r.balance])).toEqual([
      [a.order_no, a.total, a.total, 0],
      [b.order_no, b.total, 1000, b.total - 1000],
    ]);
    expect(sales.rows[0].customer).toBe('Amina Wanjiru, Acme Ltd');
    expect(sales.totals).toMatchObject({ invoiced: a.total + b.total, paid: a.total + 1000 });

    const payments = (await get('/reports/payments')).body.report;
    expect(payments.rows.map((r) => [r.receipt, r.mpesa, r.method, r.amount])).toEqual([
      ['RCT00001', 'REP0000001', 'Paybill', a.total],
      ['RCT00002', 'REP0000002', 'Paybill', 1000],
    ]);
    expect(payments.summary[0]).toEqual({ label: 'Received', value: `KES ${(a.total + 1000).toLocaleString('en-KE')}` });

    // Owed: B is in production with a balance; A is paid. A new order waiting for its first payment
    // would expire unpaid, so it is neither owed nor a sale yet.
    await place({ name: 'Just Placed', company: '', email: 'new@example.co.ke', phone: '0711 000 444' });
    const owed = (await get('/reports/receivables')).body.report;
    expect(owed.subtitle).toMatch(/^As at /);
    expect(owed.rows.map((r) => [r.order, r.balance, r.age])).toEqual([[b.order_no, b.total - 1000, 0]]);
    expect((await get('/reports/sales')).body.report.rows).toHaveLength(2);

    const byProduct = (await get('/reports/products')).body.report;
    expect(byProduct.rows).toEqual([{ product: 'T-shirt printing', category: 'Apparel', orders: 2, pieces: 240, invoiced: expect.any(Number), paid: a.total + 1000 }]);
  });

  it('downloads a report as PDF and CSV, with spreadsheet formulas made harmless', async () => {
    const o = await place({ name: '=HYPERLINK("http://x.example","Click")', company: '' });
    await pay(o, 500, 'REP0000003');

    const pdf = await get('/reports/payments?format=pdf').buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toBe(`attachment; filename="noorcom-payments-${monthStart}-to-${today}.pdf"`);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');

    const csv = await get('/reports/payments?format=csv');
    expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.text.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('Receipt,Date,Order,Customer,Method,M-Pesa ref,For,Amount (KES)');
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://x.example"",""Click"")"`);
    expect(lines.at(-1)).toBe('Total,,,,,,,500');
  });

  it('refuses a period that runs backwards, a report that does not exist and a date that is not real', async () => {
    expect((await get('/reports/sales?from=2026-10-08&to=2026-10-01')).body.message).toBe('The start date is after the end date.');
    expect((await get('/reports/nope')).status).toBe(400);
    expect((await get('/reports/sales?from=2026-02-30')).status).toBe(400);
  });

  it('lists customer accounts and builds a statement with the balance brought forward', async () => {
    const old = await place();
    const recent = await place({}, { quantity: 60 });
    await place({ name: 'Brian Otieno', company: '', email: 'brian@example.co.ke', phone: '0711 000 222' });
    await pay(old, 2000, 'REP0000004');
    // The first order and its payment were last month.
    const lastMonth = new Date(Date.parse(`${monthStart}T12:00:00+03:00`) - 10 * 86_400_000);
    await knex('orders').where({ id: old.id }).update({ created_at: lastMonth, status: 'in_production' });
    await knex('invoices').where({ order_id: old.id }).update({ created_at: lastMonth });
    await knex('payments').where({ order_id: old.id }).update({ created_at: lastMonth });
    await pay(recent, 3000, 'REP0000005');

    const list = (await get('/accounts')).body.accounts;
    expect(list.map((a) => a.email)).toEqual(['amina@example.co.ke', 'brian@example.co.ke']);
    expect(list[0]).toMatchObject({ name: 'Amina Wanjiru', orders: 2, invoiced: old.total + recent.total, paid: 5000, balance: old.total + recent.total - 5000 });
    expect((await get('/accounts?q=otieno')).body.accounts.map((a) => a.email)).toEqual(['brian@example.co.ke']);

    const s = (await get(`/accounts/statement?email=Amina@Example.co.ke&from=${monthStart}&to=${today}`)).body.report;
    expect(s.opening).toBe(old.total - 2000);
    expect(s.rows[0]).toMatchObject({ description: 'Balance brought forward', balance: old.total - 2000 });
    expect(s.rows.slice(1).map((r) => [r.order, r.debit, r.credit, r.balance])).toEqual([
      [recent.order_no, recent.total, null, old.total - 2000 + recent.total],
      [recent.order_no, null, 3000, old.total - 2000 + recent.total - 3000],
    ]);
    expect(s.closing).toBe(old.total + recent.total - 5000);
    expect(s.summary.at(-1)).toEqual({ label: 'Balance due', value: `KES ${s.closing.toLocaleString('en-KE')}` });

    const pdf = await get(`/accounts/statement?email=amina@example.co.ke&format=pdf`);
    expect(pdf.headers['content-disposition']).toBe(`attachment; filename="noorcom-statement-amina-${monthStart}-to-${today}.pdf"`);
    expect((await get('/accounts/statement?email=nobody@example.co.ke')).status).toBe(404);
    expect((await get('/accounts/statement?email=not-an-email')).status).toBe(400);
  });
});
