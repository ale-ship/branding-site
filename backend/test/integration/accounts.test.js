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
import { hashToken } from '../../src/lib/ids.js';
import { createLogger } from '../../src/lib/logger.js';
import { addStaff } from '../../src/modules/staff/service.js';

/**
 * Step B5, customer accounts, against a real Postgres (skipped without it): sign-in by an emailed
 * code, the account built from the orders placed with its email, its details, brand kit and
 * addresses, reorders, the statement, orders opened by the session, and company accounts with their
 * orders and approvals.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });
const PASSWORD = 'correct horse battery';
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

describe.skipIf(!dbUrl)('customer accounts (B5)', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  const dir = mkdtempSync(join(tmpdir(), 'nb-storage-'));
  let mails, queued, deps, app, designer;

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE price_tiers, products, categories, staff_users, customer_profiles, sign_in_codes, customer_sessions, companies, c2b_confirmations RESTART IDENTITY CASCADE');
    await knex.raw('TRUNCATE orders RESTART IDENTITY CASCADE');
    await knex.raw('UPDATE counters SET value = 0');
    await knex.seed.run();
    mails = [];
    queued = [];
    deps = {
      pool,
      redis: null,
      logger,
      config,
      storage: createStorage({ dir }),
      mailer: { mode: 'fake', send: async (m) => void mails.push(m) },
      jobs: { enqueue: async (name, data) => void queued.push({ name, data }), schedule: async () => {}, close: async () => {} },
    };
    app = createApp(config, deps);
    await addStaff(deps, null, { email: 'designer@noorcombranding.co.ke', name: 'The designer', role: 'designer', password: PASSWORD });
    designer = request.agent(app);
    await designer.post('/api/staff/auth/sign-in').send({ email: 'designer@noorcombranding.co.ke', password: PASSWORD });
  });
  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    await knex?.destroy();
    await pool?.end();
  });

  const codeIn = (mail) => /(\d{6}) is your/.exec(mail.subject)[1];
  async function signIn(email) {
    await request(app).post('/api/account/code').send({ email });
    const code = codeIn(mails.at(-1));
    return (await request(app).post('/api/account/verify').send({ email, code })).body.session;
  }
  const as = (session) => ({
    get: (path) => request(app).get(path).set('x-account-session', session),
    put: (path, body) => request(app).put(path).set('x-account-session', session).send(body),
    post: (path, body) => request(app).post(path).set('x-account-session', session).send(body),
    del: (path) => request(app).delete(path).set('x-account-session', session),
  });
  const place = async (over, session) => {
    const req = request(app).post('/api/orders');
    if (session) req.set('x-account-session', session);
    return (await req.send(tshirts(over))).body;
  };
  async function paybill(ref, amount) {
    await request(app).post('/api/dev/c2b').send({ ref, amount });
    for (const job of queued.splice(0)) if (job.name === 'process-c2b') await runJob(deps, job.name, job.data);
  }
  /** Placed, deposit paid and a proof waiting for the customer. */
  async function withProof(over, session) {
    const placed = await place(over, session);
    const o = (await request(app).get(`/api/orders/${placed.ref}`).set('x-order-token', placed.token)).body;
    await paybill(placed.ref, o.dueNow);
    await designer.post(`/api/staff/orders/${placed.ref}/proofs`).set('x-requested-with', 'nb-admin').set('content-type', 'image/png').send(PNG);
    return placed;
  }

  it('emails a code, keeps only its hash, and limits resends', async () => {
    const res = await request(app).post('/api/account/code').send({ email: ' Amina@Example.co.ke ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sentTo: 'am•••@example.co.ke' });
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe('amina@example.co.ke');
    const code = codeIn(mails[0]);
    expect(mails[0].text).toContain(code);
    const row = await knex('sign_in_codes').where({ email: 'amina@example.co.ke' }).first();
    expect(row.code_hash).toBe(hashToken(`amina@example.co.ke:${code}`));
    expect(JSON.stringify(row)).not.toContain(code);

    const again = await request(app).post('/api/account/code').send({ email: 'amina@example.co.ke' });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/another in \d+ seconds/);
    expect((await request(app).post('/api/account/code').send({ email: 'not-an-email' })).status).toBe(400);
  });

  it('signs in with the right code once, and gives up after five wrong tries', async () => {
    await request(app).post('/api/account/code').send({ email: 'amina@example.co.ke' });
    const code = codeIn(mails[0]);
    const wrong = await request(app).post('/api/account/verify').send({ email: 'amina@example.co.ke', code: code === '000000' ? '111111' : '000000' });
    expect(wrong.status).toBe(400);
    const ok = await request(app).post('/api/account/verify').send({ email: 'amina@example.co.ke', code });
    expect(ok.status).toBe(200);
    expect(ok.body.session).toMatch(/^[0-9a-f]{64}$/);
    expect(await knex('customer_sessions').where({ token_hash: hashToken(ok.body.session) }).first()).toMatchObject({ email: 'amina@example.co.ke' });
    // A code works once.
    expect((await request(app).post('/api/account/verify').send({ email: 'amina@example.co.ke', code })).status).toBe(400);

    await knex('sign_in_codes').del();
    await request(app).post('/api/account/code').send({ email: 'brian@example.co.ke' });
    const right = codeIn(mails.at(-1));
    for (let i = 0; i < 5; i++) await request(app).post('/api/account/verify').send({ email: 'brian@example.co.ke', code: right === '000000' ? '111111' : '000000' });
    expect((await request(app).post('/api/account/verify').send({ email: 'brian@example.co.ke', code: right })).status).toBe(400);
  });

  it('builds the account from the orders placed with its email, and signs out', async () => {
    const guest = await place();
    await place({ customer: { name: 'Someone Else', company: '', phone: '0711 000 000', email: 'other@example.co.ke' } });
    const session = await signIn('amina@example.co.ke');
    const me = await as(session).get('/api/account');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: 'amina@example.co.ke', name: 'Amina Wanjiru', phone: '+254722530301', company: 'Acme Ltd', brandKit: null, addresses: [], credit: 0, companyAccount: null, companyOrders: [] });
    expect(me.body.orders).toEqual([expect.objectContaining({ ref: guest.ref, status: 'awaiting_payment', productSlug: 't-shirt-printing', quantity: 120, canReorder: false })]);

    // The session opens the account's own orders, and no one else's.
    expect((await as(session).get(`/api/orders/${guest.ref}`)).body.ref).toBe(guest.ref);
    const other = (await knex('orders').where({ customer_email: 'other@example.co.ke' }).first()).order_no;
    expect((await as(session).get(`/api/orders/${other}`)).status).toBe(404);

    expect((await as(session).post('/api/account/sign-out')).status).toBe(200);
    expect((await as(session).get('/api/account')).status).toBe(404);
    expect((await as(session).get(`/api/orders/${guest.ref}`)).status).toBe(404);
    expect((await as('made-up').get('/api/account')).status).toBe(404);
  });

  it('keeps details, a brand kit and addresses', async () => {
    const s = as(await signIn('amina@example.co.ke'));
    expect((await s.put('/api/account/details', { name: 'Amina W.', phone: '0733 111 222', company: 'Acme' })).body).toMatchObject({ name: 'Amina W.', phone: '+254733111222', company: 'Acme' });
    expect((await s.put('/api/account/details', { name: 'A', phone: '', company: '' })).status).toBe(400);
    expect((await s.put('/api/account/details', { name: 'Amina', phone: '12', company: '' })).status).toBe(400);

    const kit = { colours: ['#D7000F', '485 C'], typography: 'named', fonts: 'Inter', logos: [{ name: 'logo.svg', size: 1200, type: 'image/svg+xml' }], notes: 'Red on white' };
    expect((await s.put('/api/account/brand-kit', kit)).body.brandKit).toEqual(kit);
    expect((await s.put('/api/account/brand-kit', { ...kit, colours: ['not a colour!'] })).status).toBe(400);

    let me = (await s.post('/api/account/addresses', { label: 'Office', address: 'Loita Street, Nairobi', zone: 'cbd' })).body;
    const id = me.addresses[0].id;
    expect(me.addresses).toEqual([{ id: expect.stringMatching(/^ADR-\d{6}$/), label: 'Office', address: 'Loita Street, Nairobi', zone: 'cbd' }]);
    me = (await s.post('/api/account/addresses', { id, label: 'Head office', address: 'Loita Street, Nairobi', zone: 'cbd' })).body;
    expect(me.addresses).toHaveLength(1);
    expect(me.addresses[0].label).toBe('Head office');
    for (let i = 0; i < 4; i++) await s.post('/api/account/addresses', { label: `A${i}`, address: `Street ${i}, Nairobi`, zone: 'cbd' });
    expect((await s.post('/api/account/addresses', { label: 'Six', address: 'One too many', zone: 'cbd' })).status).toBe(400);
    expect((await s.post('/api/account/addresses', { label: 'Short', address: 'x' })).status).toBe(400);
    expect((await s.del(`/api/account/addresses/${id}`)).body.addresses).toHaveLength(4);
  });

  it('reorders an approved design and gives the statement', async () => {
    const session = await signIn('amina@example.co.ke');
    const placed = await withProof();
    expect((await as(session).get(`/api/account/reorder/${placed.ref}`)).status).toBe(409);
    expect((await as(session).post(`/api/orders/${placed.ref}/proofs/1/approve`, { checklist: CHECKLIST })).status).toBe(200);

    const draft = (await as(session).get(`/api/account/reorder/${placed.ref}`)).body;
    expect(draft).toMatchObject({ from: placed.ref, product: 't-shirt-printing', quantity: 120, urgency: 'standard', common: { artwork: 'print-ready' } });
    expect(draft.common.notes).toContain('approved proof v1');
    expect((await as(session).get('/api/account')).body.orders[0].canReorder).toBe(true);
    expect((await as(session).get('/api/account/reorder/NB-000000')).status).toBe(404);

    const statement = (await as(session).get('/api/account/statement')).body;
    expect(statement.lines.map((l) => l.document)).toEqual(['INV00001', 'RCT00001']);
    expect(statement.balance).toBe(statement.invoiced - statement.paid);
  });

  it('runs a company: members, company orders and who approves them', async () => {
    const owner = as(await signIn('amina@example.co.ke'));
    await owner.put('/api/account/details', { name: 'Amina Wanjiru', phone: '', company: 'Acme Ltd' });
    expect((await owner.post('/api/account/company', { name: 'Acme Ltd', kraPin: 'bad' })).status).toBe(400);
    let me = (await owner.post('/api/account/company', { name: 'Acme Ltd', kraPin: 'p051234567x' })).body;
    expect(me.companyAccount).toMatchObject({ id: expect.stringMatching(/^CO-\d{6}$/), name: 'Acme Ltd', kraPin: 'P051234567X', role: 'owner' });
    expect((await owner.post('/api/account/company', { name: 'Again' })).status).toBe(409);

    me = (await owner.post('/api/account/company/members', { email: 'Brian@Example.co.ke', name: 'Brian Otieno', role: 'member' })).body;
    expect(me.companyAccount.members.map((m) => [m.email, m.role])).toEqual([['amina@example.co.ke', 'owner'], ['brian@example.co.ke', 'member']]);
    expect((await owner.post('/api/account/company/members', { email: 'brian@example.co.ke', name: 'Brian', role: 'member' })).status).toBe(400);

    const brianSession = await signIn('brian@example.co.ke');
    const brian = as(brianSession);
    expect((await brian.post('/api/account/company/members', { email: 'x@example.co.ke', name: 'X Person', role: 'member' })).status).toBe(409);

    // Brian orders for the company: only with his own session and email.
    const customer = { name: 'Brian Otieno', company: 'Acme Ltd', phone: '0711 222 333', email: 'brian@example.co.ke' };
    expect((await request(app).post('/api/orders').send(tshirts({ customer, company: { poNumber: 'PO-1' } }))).status).toBe(400);
    const placed = await withProof({ customer, company: { id: 'CO-999999', poNumber: 'PO-77' } }, brianSession);
    const row = await knex('orders').where({ order_no: placed.ref }).first();
    expect(row.company_id).toBe(me.companyAccount.id);
    expect(row.company_po).toBe('PO-77');

    // The owner sees it on the account and can open it; the order names who approves.
    me = (await owner.get('/api/account')).body;
    expect(me.companyOrders).toEqual([expect.objectContaining({ ref: placed.ref, placedBy: 'Brian Otieno' })]);
    const order = (await owner.get(`/api/orders/${placed.ref}`)).body;
    expect(order.company).toEqual({ id: me.companyAccount.id, name: 'Acme Ltd', poNumber: 'PO-77', approvers: ['Amina Wanjiru'] });
    expect((await brian.get('/api/account')).body.companyOrders).toEqual([]);

    // A member can't approve, by session or by the link; the owner can.
    const refused = await brian.post(`/api/orders/${placed.ref}/proofs/1/approve`, { checklist: CHECKLIST });
    expect(refused.status).toBe(409);
    expect(refused.body.message).toContain('approved by Amina Wanjiru');
    expect((await request(app).post(`/api/orders/${placed.ref}/proofs/1/approve`).set('x-order-token', placed.token).send({ checklist: CHECKLIST })).status).toBe(409);
    expect((await owner.post(`/api/orders/${placed.ref}/proofs/1/approve`, { checklist: CHECKLIST })).status).toBe(200);
    expect((await owner.get('/api/account/statement')).body.lines).toEqual([]);

    // Removing: never the owner; Brian then no longer orders for the company.
    expect((await owner.del('/api/account/company/members/amina@example.co.ke')).status).toBe(400);
    me = (await owner.del('/api/account/company/members/brian@example.co.ke')).body;
    expect(me.companyAccount.members).toHaveLength(1);
    expect((await request(app).post('/api/orders').set('x-account-session', brianSession).send(tshirts({ customer, company: { poNumber: '' } }))).status).toBe(400);
  });
});
