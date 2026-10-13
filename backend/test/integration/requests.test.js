import 'dotenv/config';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { seedContent } from '../../src/db/migrations/008_content.js';
import { parseConfig } from '../../src/config.js';
import { createPool } from '../../src/db/pool.js';
import { createLogger } from '../../src/lib/logger.js';
import { addStaff } from '../../src/modules/staff/service.js';

/**
 * Requests (B5) against a real Postgres (skipped without it): the site's quote and contact forms
 * stored with their references, staff emailed and the customer acknowledged, and the staff inbox.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const config = parseConfig({ NODE_ENV: 'test', STAFF_INBOX: 'inbox@noorcombranding.co.ke' });
const logger = createLogger({ env: 'test' });
const PASSWORD = 'correct horse battery';

const quote = (over = {}) => ({
  service: 'vehicle-branding',
  products: [{ slug: 'mug-branding', quantity: 50, options: { Mug: 'White ceramic' } }],
  quantity: 3,
  details: 'Three vans, full wraps, our new colours.',
  artwork: [{ name: 'logo.pdf', size: 120000, type: 'application/pdf' }],
  needsDesign: false,
  deadline: '2026-11-20',
  fulfilment: 'install',
  location: 'Industrial Area, Nairobi',
  name: 'Brian Otieno',
  company: 'Acme Logistics',
  phone: '0722 530 301',
  email: 'Brian@Example.co.ke',
  preferredContact: 'whatsapp',
  ...over,
});

describe.skipIf(!dbUrl)('requests (B5)', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  let queued, app, staff;

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
  });
  beforeEach(async () => {
    await knex.raw('TRUNCATE requests, notifications, staff_users RESTART IDENTITY CASCADE');
    // The cascade empties the website's content (it names who changed it): requests read its names.
    await seedContent(knex);
    queued = [];
    const deps = { pool, redis: null, logger, config, jobs: { enqueue: async (name, data) => void queued.push({ name, data }), schedule: async () => {}, close: async () => {} } };
    app = createApp(config, deps);
    await addStaff(deps, null, { email: 'designer@noorcombranding.co.ke', name: 'The designer', role: 'designer', password: PASSWORD });
    staff = request.agent(app);
    await staff.post('/api/staff/auth/sign-in').send({ email: 'designer@noorcombranding.co.ke', password: PASSWORD });
  });
  afterAll(async () => {
    await knex?.destroy();
    await pool?.end();
  });

  it('stores a quote request, emails staff and acknowledges the customer', async () => {
    const res = await request(app).post('/api/requests/quote').send(quote());
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^NQ-\d{6}$/);
    const row = await knex('requests').where({ ref: res.body.reference }).first();
    expect(row).toMatchObject({ kind: 'quote', status: 'new', name: 'Brian Otieno', company: 'Acme Logistics', phone: '+254722530301', email: 'brian@example.co.ke' });
    expect(row.data.details).toBe('Three vans, full wraps, our new colours.');

    const mail = await knex('notifications').orderBy('id');
    expect(mail.map((m) => [m.order_id, m.channel, m.recipient, m.template])).toEqual([
      [null, 'email', 'inbox@noorcombranding.co.ke', 'request-quote'],
      [null, 'email', 'brian@example.co.ke', 'request-received'],
    ]);
    expect(mail[0].payload.text).toContain('Vehicle branding, 3 pieces');
    expect(mail[0].payload.text).toContain('Mug branding × 50 (Mug: White ceramic)');
    expect(mail[1].payload.text).toContain(res.body.reference);
    expect(queued.map((j) => j.name)).toEqual(['send-notification', 'send-notification']);
  });

  it('stores a contact message, and refuses what isn’t a request', async () => {
    const res = await request(app).post('/api/requests/contact').send({ name: 'Amina', phone: '', email: 'amina@example.co.ke', message: 'Do you print on glass?' });
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^NM-\d{6}$/);
    expect(await knex('requests').where({ ref: res.body.reference }).first()).toMatchObject({ kind: 'message', preferred_contact: 'email' });

    expect((await request(app).post('/api/requests/quote').send(quote({ service: '', products: [] }))).status).toBe(400);
    expect((await request(app).post('/api/requests/quote').send(quote({ phone: '12', email: '' }))).status).toBe(400);
    expect((await request(app).post('/api/requests/quote').send(quote({ phone: '', email: '' }))).status).toBe(400);
    expect((await request(app).post('/api/requests/contact').send({ name: 'A', phone: '', email: 'a@b.co', message: 'Hi' })).status).toBe(400);
    expect(await knex('requests').count({ n: '*' }).first()).toEqual({ n: '1' });
  });

  it('gives staff an inbox to search, move along and note, with the dashboard count', async () => {
    const a = (await request(app).post('/api/requests/quote').send(quote())).body.reference;
    const b = (await request(app).post('/api/requests/contact').send({ name: 'Amina Wanjiru', phone: '0711 222 333', email: '', message: 'Do you print on glass?' })).body.reference;

    expect((await request(app).get('/api/staff/requests')).status).toBe(401);
    let list = (await staff.get('/api/staff/requests')).body.requests;
    expect(list.map((r) => r.ref)).toEqual([b, a]);
    expect((await staff.get('/api/staff/dashboard')).body.requests).toBe(2);
    expect((await staff.get('/api/staff/requests?q=acme')).body.requests.map((r) => r.ref)).toEqual([a]);

    const changed = await staff.patch(`/api/staff/requests/${a}`).set('x-requested-with', 'nb-admin').send({ status: 'in_progress', note: 'Called; survey on Friday.' });
    expect(changed.status).toBe(200);
    expect(changed.body.request).toMatchObject({ ref: a, status: 'in_progress', note: 'Called; survey on Friday.', handledBy: 'The designer' });
    expect((await staff.get('/api/staff/requests?status=new')).body.requests.map((r) => r.ref)).toEqual([b]);
    expect((await staff.get(`/api/staff/requests/${a}`)).body.request.data.location).toBe('Industrial Area, Nairobi');
    expect(await knex('audit_log').where({ action: 'request-updated' }).count({ n: '*' }).first()).toEqual({ n: '1' });

    expect((await staff.patch(`/api/staff/requests/${a}`).send({ status: 'closed' })).status).toBe(403);
    expect((await staff.patch('/api/staff/requests/NQ-000000').set('x-requested-with', 'nb-admin').send({ status: 'closed' })).status).toBe(404);
    expect((await staff.patch(`/api/staff/requests/${a}`).set('x-requested-with', 'nb-admin').send({})).status).toBe(400);
  });
});
