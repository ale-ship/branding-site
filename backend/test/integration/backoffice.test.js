import 'dotenv/config';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { createPool, withTransaction } from '../../src/db/pool.js';
import { runJob } from '../../src/jobs/handlers/index.js';
import { createLogger } from '../../src/lib/logger.js';
import { record } from '../../src/modules/payments/ledger.js';
import { addStaff } from '../../src/modules/staff/service.js';

/**
 * Step B4, the back office's API, against a real Postgres (TEST_DATABASE_URL; skipped without it):
 * staff sign-in and roles, staff accounts, the order board, and orders run through by staff steps
 * from production to handover.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });
const PASSWORD = 'correct horse battery';

const tshirts = (over = {}) => ({
  product: 't-shirt-printing',
  quantity: 120,
  brief: { garmentColour: 'Black', sizes: { S: 20, M: 40, L: 40, XL: 20, XXL: 0 }, positions: ['front'], method: 'screen', printColours: 1 },
  needsDesign: false,
  urgency: 'standard',
  handover: { method: 'pickup' },
  common: { colours: [], typography: 'from-logo', fonts: '', assets: [], inspiration: [], inspirationLinks: [], text: 'Noorcom', styles: [], artwork: 'print-ready', notes: '' },
  customer: { name: 'Amina Wanjiru', company: 'Acme Ltd', phone: '0722 530 301', email: 'amina@example.co.ke' },
  ...over,
});

describe.skipIf(!dbUrl)('the back office API (B4)', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  /** @type {{ name: string; data: any }[]} */
  let queued;
  let deps;
  let app;
  /** Signed-in agents by role. */
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
    deps = { pool, redis: null, logger, config, jobs: { enqueue: async (name, data) => void queued.push({ name, data }), schedule: async () => {}, close: async () => {} } };
    app = createApp(config, deps);
    for (const role of ['admin', 'sales', 'production', 'designer']) {
      await addStaff(deps, null, { email: `${role}@noorcombranding.co.ke`, name: `The ${role}`, role, password: PASSWORD });
      as[role] = request.agent(app);
      const res = await as[role].post('/api/staff/auth/sign-in').send({ email: `${role}@noorcombranding.co.ke`, password: PASSWORD });
      expect(res.status).toBe(200);
    }
  });
  afterAll(async () => {
    await knex?.destroy();
    await pool?.end();
  });

  const send = (role, path, body = {}) => as[role].post(path).set('x-requested-with', 'nb-admin').send(body);
  const place = async (over) => (await request(app).post('/api/orders').send(tshirts(over))).body;
  const customerView = async ({ ref, token }) => (await request(app).get(`/api/orders/${ref}`).set('x-order-token', token)).body;
  /** Proofs and the balance come with part 3: put the order straight into production. */
  const intoProduction = (ref) => knex('orders').where({ order_no: ref }).update({ status: 'in_production', due_now: 0, due_purpose: null, expires_at: null });

  describe('signing in', () => {
    it('sets an httpOnly, SameSite=Strict cookie scoped to /api/staff', async () => {
      const res = await request(app).post('/api/staff/auth/sign-in').send({ email: 'Admin@noorcombranding.co.ke', password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.staff).toEqual({ id: 1, email: 'admin@noorcombranding.co.ke', name: 'The admin', role: 'admin', active: true });
      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/^nb_staff=[0-9a-f]{32};/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\/api\/staff/);
      // Only the token's hash is stored.
      const token = cookie.slice(9, 41);
      expect(JSON.stringify(await knex('staff_sessions').select())).not.toContain(token);
    });

    it('gives the same answer for a wrong password, an unknown email and a deactivated account', async () => {
      await knex('staff_users').where({ role: 'designer' }).update({ active: false });
      const answers = await Promise.all([
        request(app).post('/api/staff/auth/sign-in').send({ email: 'admin@noorcombranding.co.ke', password: 'wrong password!' }),
        request(app).post('/api/staff/auth/sign-in').send({ email: 'nobody@noorcombranding.co.ke', password: PASSWORD }),
        request(app).post('/api/staff/auth/sign-in').send({ email: 'designer@noorcombranding.co.ke', password: PASSWORD }),
      ]);
      for (const res of answers) {
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('That email and password don’t match an active staff account.');
      }
    });

    it('needs a session, and the back office’s header on changes', async () => {
      expect((await request(app).get('/api/staff/me')).status).toBe(401);
      expect((await as.admin.get('/api/staff/me')).body.staff.role).toBe('admin');
      const forged = await as.admin.post('/api/staff/users').send({ email: 'x@y.co.ke', name: 'X', role: 'sales', password: PASSWORD });
      expect(forged.status).toBe(403);
    });

    it('signs out', async () => {
      expect((await send('sales', '/api/staff/auth/sign-out')).status).toBe(204);
      expect((await as.sales.get('/api/staff/me')).status).toBe(401);
    });
  });

  describe('staff accounts (admin)', () => {
    it('lets an admin add and change staff, and nobody else', async () => {
      expect((await send('sales', '/api/staff/users', { email: 'new@noorcombranding.co.ke', name: 'New', role: 'sales', password: PASSWORD })).status).toBe(403);
      const added = await send('admin', '/api/staff/users', { email: 'New@Noorcombranding.co.ke', name: 'New Person', role: 'installer', password: PASSWORD });
      expect(added.status).toBe(201);
      expect(added.body.user).toMatchObject({ email: 'new@noorcombranding.co.ke', role: 'installer' });
      expect((await send('admin', '/api/staff/users', { email: 'new@noorcombranding.co.ke', name: 'Again', role: 'sales', password: PASSWORD })).status).toBe(409);
      expect((await send('admin', '/api/staff/users', { email: 'short@noorcombranding.co.ke', name: 'Short', role: 'sales', password: 'short' })).status).toBe(400);
      const users = (await as.admin.get('/api/staff/users')).body.users;
      expect(users.map((u) => u.email)).toContain('new@noorcombranding.co.ke');
      expect(JSON.stringify(users)).not.toContain('scrypt');
    });

    it('signs a deactivated member out everywhere, and keeps one active admin', async () => {
      const sales = (await as.admin.get('/api/staff/users')).body.users.find((u) => u.role === 'sales');
      await as.admin.patch(`/api/staff/users/${sales.id}`).set('x-requested-with', 'nb-admin').send({ active: false });
      expect((await as.sales.get('/api/staff/me')).status).toBe(401);
      const res = await as.admin.patch('/api/staff/users/1').set('x-requested-with', 'nb-admin').send({ role: 'sales' });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/one active admin/);
    });
  });

  describe('the order board', () => {
    it('lists orders by column and finds them by number, name or phone', async () => {
      const a = await place();
      const b = await place({ customer: { ...tshirts().customer, name: 'Brian Otieno', phone: '0733 000 004' } });
      await intoProduction(b.ref);
      const all = (await as.designer.get('/api/staff/orders')).body.orders;
      expect(all.map((o) => o.ref).sort()).toEqual([a.ref, b.ref].sort());
      expect(all[0]).toMatchObject({ product: { slug: 't-shirt-printing' }, quantity: 120, handover: 'pickup', overdue: false });
      expect((await as.designer.get('/api/staff/orders?column=production')).body.orders.map((o) => o.ref)).toEqual([b.ref]);
      expect((await as.designer.get('/api/staff/orders?q=brian')).body.orders.map((o) => o.ref)).toEqual([b.ref]);
      expect((await as.designer.get('/api/staff/orders?q=0733')).body.orders).toHaveLength(0);
      expect((await as.designer.get('/api/staff/orders?q=%2B254733')).body.orders.map((o) => o.ref)).toEqual([b.ref]);
    });

    it('marks an order overdue once its date has passed', async () => {
      const a = await place();
      await intoProduction(a.ref);
      await knex('orders').where({ order_no: a.ref }).update({ promised_date: '2026-01-05' });
      expect((await as.sales.get('/api/staff/orders')).body.orders[0].overdue).toBe(true);
    });
  });

  describe('running an order through', () => {
    it('logs production, marks it ready with a pickup code, and hands it over at the counter', async () => {
      const placed = await place();
      await intoProduction(placed.ref);

      expect((await send('designer', `/api/staff/orders/${placed.ref}/progress`, { pieces: 50 })).status).toBe(403);
      expect((await send('production', `/api/staff/orders/${placed.ref}/progress`, { pieces: 200 })).body.message).toBe('Only 120 pieces are left on this order.');
      expect((await send('production', `/api/staff/orders/${placed.ref}/progress`, { pieces: 80, note: 'front prints' })).status).toBe(200);
      const early = await send('production', `/api/staff/orders/${placed.ref}/ready`);
      expect(early.status).toBe(409);
      expect(early.body.message).toBe('40 pieces are still to print.');
      await send('production', `/api/staff/orders/${placed.ref}/progress`, { pieces: 40 });
      const ready = await send('production', `/api/staff/orders/${placed.ref}/ready`);
      expect(ready.body.order.status).toBe('ready');
      const code = ready.body.order.pickupCode;
      expect(code).toMatch(/^\d{6}$/);

      const wrong = await send('sales', `/api/staff/orders/${placed.ref}/handover`, { code: code === '000000' ? '111111' : '000000', collector: 'Amina' });
      expect(wrong.body.message).toBe('That pickup code doesn’t match this order.');
      const done = await send('sales', `/api/staff/orders/${placed.ref}/handover`, { code, collector: 'Amina Wanjiru' });
      expect(done.body.order.status).toBe('completed');

      // What the customer sees.
      const view = await customerView(placed);
      expect(view).toMatchObject({ status: 'completed', pickupCode: code, progress: { kind: 'pieces', done: 120, total: 120 } });
      expect(view.production.logs.map((l) => [l.pieces, l.note])).toEqual([
        [80, 'front prints'],
        [40, ''],
      ]);
      expect(view.handedOver).toMatchObject({ method: 'pickup', detail: 'Collected by Amina Wanjiru with the pickup code.' });
      expect(view.events.map((e) => e.text)).toEqual([
        'Order placed.',
        '80 printed (front prints). 80 of 120 done.',
        '40 printed. 120 of 120 done.',
        'Ready for pickup. Show your pickup code at the counter.',
        'Collected by Amina Wanjiru with the pickup code.',
        'Order complete. Thank you!',
      ]);
      // The customer was told it is ready (with the code) and that it is done.
      const templates = (await knex('notifications').orderBy('id').pluck('template')).filter((t) => t !== 'order-placed');
      expect(templates).toEqual(['ready', 'ready', 'completed', 'completed']);
      expect((await knex('notifications').where({ template: 'ready', channel: 'whatsapp' }).first()).payload.text).toContain(code);
      expect(queued.filter((j) => j.name === 'send-notification')).toHaveLength(6);

      // Staff see who did what.
      const audit = (await as.admin.get(`/api/staff/orders/${placed.ref}`)).body.staff.audit;
      expect(audit.map((a) => [a.action, a.staff])).toEqual([
        ['handed-over', 'The sales'],
        ['marked-ready', 'The production'],
        ['production-logged', 'The production'],
        ['production-logged', 'The production'],
      ]);
    });

    it('sends a delivery out with a rider and closes it with the recipient', async () => {
      const placed = await place({ handover: { method: 'delivery', zone: 'inner', address: 'Kilimani, Nairobi' } });
      await intoProduction(placed.ref);
      await send('production', `/api/staff/orders/${placed.ref}/progress`, { pieces: 120 });
      await send('production', `/api/staff/orders/${placed.ref}/ready`);
      expect((await send('sales', `/api/staff/orders/${placed.ref}/dispatch`, { rider: 'Kevin' })).body.message).toMatch(/rider’s name and phone/);
      const out = await send('sales', `/api/staff/orders/${placed.ref}/dispatch`, { rider: 'Kevin', riderPhone: '0711 222 333' });
      expect(out.body.order.status).toBe('out_for_handover');
      await send('sales', `/api/staff/orders/${placed.ref}/handover`, { recipient: 'Reception, Acme Ltd' });
      const view = await customerView(placed);
      expect(view.status).toBe('completed');
      expect(view.deliveries).toEqual([
        expect.objectContaining({ pieces: 120, partial: false, status: 'delivered', rider: 'Kevin', riderPhone: '0711 222 333', recipient: 'Reception, Acme Ltd' }),
      ]);
    });

    it('cancels before production, lets go of the machine time, and flags money to refund', async () => {
      const unpaid = await place();
      expect(await knex('capacity_bookings').count({ n: '*' }).first()).toEqual({ n: '1' });
      expect((await send('sales', `/api/staff/orders/${unpaid.ref}/cancel`, { reason: '' })).status).toBe(400);
      const res = await send('sales', `/api/staff/orders/${unpaid.ref}/cancel`, { reason: 'Customer changed their mind' });
      expect(res.body.order).toMatchObject({ status: 'cancelled', dueNow: 0 });
      expect(res.body.staff.attention).toBeNull();
      expect(await knex('capacity_bookings').count({ n: '*' }).first()).toEqual({ n: '0' });

      const paid = await place();
      const { id } = await knex('orders').where({ order_no: paid.ref }).first();
      await withTransaction(pool, (t) => record(t, { orderId: id, method: 'paybill', phone: null, amount: 1000, mpesaReceipt: 'CANCEL0001' }));
      const flagged = await send('sales', `/api/staff/orders/${paid.ref}/cancel`, { reason: 'Duplicate order' });
      expect(flagged.body.staff.attention).toBe('refund-due');
      expect((await send('sales', `/api/staff/orders/${paid.ref}/attention/clear`)).body.staff.attention).toBeNull();

      await intoProduction((await place()).ref);
      const busy = (await as.sales.get('/api/staff/orders?column=production')).body.orders[0];
      expect((await send('sales', `/api/staff/orders/${busy.ref}/cancel`, { reason: 'Too late' })).status).toBe(409);
    });
  });

  describe('the dashboard', () => {
    it('counts this month, the last 30 days of money, the pipeline and what needs a hand', async () => {
      const a = await place();
      const b = await place();
      await intoProduction(b.ref);
      const { id } = await knex('orders').where({ order_no: a.ref }).first();
      await withTransaction(pool, (t) => record(t, { orderId: id, method: 'paybill', phone: null, amount: 1500, mpesaReceipt: 'DASH000001' }));
      await request(app).post('/api/dev/c2b').send({ billRef: 'no idea', amount: 50 });
      for (const job of queued.splice(0)) if (job.name === 'process-c2b') await runJob(deps, job.name, job.data);

      const res = await as.designer.get('/api/staff/dashboard');
      expect(res.status).toBe(200);
      const d = res.body;
      expect(d.month).toMatchObject({ revenue: 1500, orders: 2 });
      expect(d.revenueByDay).toHaveLength(30);
      expect(d.revenueByDay.at(-1)).toEqual({ day: d.today, amount: 1500, payments: 1 });
      expect(d.stages).toMatchObject({ new: 1, production: 1, done: 0 });
      expect(d.inProduction).toBe(1);
      expect(d.awaiting.orders).toBe(1);
      expect(d.unmatched).toBe(1);
      expect(d.byCategory).toEqual([{ category: 'Apparel', orders: 2, value: expect.any(Number) }]);
      expect(d.recent.map((o) => o.ref).sort()).toEqual([a.ref, b.ref].sort());
      expect((await request(app).get('/api/staff/dashboard')).status).toBe(401);
    });
  });

  describe('unmatched Paybill payments', () => {
    it('shows them to sales, who assign one to an order', async () => {
      const placed = await place();
      await request(app).post('/api/dev/c2b').send({ billRef: 'for the shirts', amount: 999 });
      for (const job of queued.splice(0)) if (job.name === 'process-c2b') await runJob(deps, job.name, job.data);
      expect((await as.production.get('/api/staff/payments/unmatched')).status).toBe(403);
      const list = (await as.sales.get('/api/staff/payments/unmatched')).body.payments;
      expect(list).toEqual([expect.objectContaining({ amount: 999, billRef: 'for the shirts', reason: 'no-match' })]);
      const res = await send('sales', `/api/staff/payments/unmatched/${list[0].id}/assign`, { ref: placed.ref.toLowerCase() });
      expect(res.body.result).toBe('assigned RCT00001');
      expect((await customerView(placed)).amountPaid).toBe(999);
      expect((await as.sales.get('/api/staff/payments/unmatched')).body.payments).toEqual([]);
    });
  });
});
