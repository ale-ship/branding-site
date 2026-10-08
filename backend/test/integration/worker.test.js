import 'dotenv/config';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import knexFactory from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import knexConfig from '../../knexfile.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { createPool } from '../../src/db/pool.js';
import { createFakeAbsa } from '../../src/integrations/absa/fake.js';
import { createMailer } from '../../src/integrations/mailer/index.js';
import { createWhatsApp } from '../../src/integrations/whatsapp/index.js';
import { runJob } from '../../src/jobs/handlers/index.js';
import { createJobs, PREFIX, QUEUE } from '../../src/jobs/queues.js';
import { createLogger } from '../../src/lib/logger.js';

/**
 * The real queue: BullMQ on Redis as the ACL user `nb` (keys `nb:*` only), a worker running the same
 * handlers as src/worker.js, and an order paid by M-Pesa through it. Needs TEST_DATABASE_URL and
 * TEST_REDIS_URL; skipped without them.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
const config = parseConfig({ NODE_ENV: 'test' });
const logger = createLogger({ env: 'test' });

describe.skipIf(!dbUrl || !redisUrl)('the worker on BullMQ (B3)', () => {
  const knex = dbUrl ? knexFactory({ ...knexConfig, connection: dbUrl }) : null;
  const pool = dbUrl ? createPool(dbUrl) : null;
  const outbox = mkdtempSync(join(tmpdir(), 'nb-worker-'));
  let redis, jobs, worker, workerConnection, app;

  beforeAll(async () => {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
    await knex.seed.run();
    redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    await redis.flushdb();
    jobs = createJobs(redisUrl);
    const deps = {
      pool,
      redis,
      logger,
      config,
      jobs,
      whatsapp: createWhatsApp({ outboxDir: join(outbox, 'whatsapp') }),
      mailer: createMailer({ from: 'Noorcom Branding <info@noorcombranding.co.ke>', outboxDir: join(outbox, 'mail'), smtp: null }),
    };
    deps.absa = createFakeAbsa({ redis, delayMs: 50, deliver: (body) => request(app).post(`/api/payments/absa/stk/${config.absa.secret}`).send(body) });
    app = createApp(config, deps);
    workerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    worker = new Worker(QUEUE, (job) => runJob(deps, job.name, job.data), { connection: workerConnection, prefix: PREFIX });
  });
  afterAll(async () => {
    await worker?.close();
    workerConnection?.disconnect();
    await jobs?.close();
    await redis?.flushdb();
    redis?.disconnect();
    rmSync(outbox, { recursive: true, force: true });
    await knex?.destroy();
    await pool?.end();
  });

  it('keeps every queue key under nb:bull', async () => {
    await jobs.schedule('outbox-sweep', 60_000);
    // SCAN, not KEYS: `nb` may not run KEYS (it is @dangerous).
    const keys = [];
    let cursor = '0';
    do {
      const [next, batch] = await redis.scan(cursor, 'COUNT', 500);
      keys.push(...batch);
      cursor = next;
    } while (cursor !== '0');
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.startsWith('nb:'))).toBe(true);
  });

  it('pays an order by M-Pesa through the real queue and sends the messages', async () => {
    const placed = (
      await request(app)
        .post('/api/orders')
        .send({
          product: 'poster-design',
          quantity: 1,
          brief: { format: 'A3 poster', concepts: '1', files: ['pdf'] },
          needsDesign: true,
          urgency: 'standard',
          handover: { method: 'digital' },
          common: { colours: [], typography: 'designer', fonts: '', assets: [], inspiration: [], inspirationLinks: [], text: '', styles: [], artwork: 'need-design', notes: '' },
          customer: { name: 'Amina Otieno', company: '', phone: '0722 530 303', email: 'amina@example.co.ke' },
        })
    ).body;
    const res = await request(app).post('/api/payments/stk').set('x-order-token', placed.token).send({ ref: placed.ref, phone: '0722530303' });
    expect(res.body.status).toBe('pending');

    let order;
    for (let i = 0; i < 100; i++) {
      order = (await request(app).get(`/api/orders/${placed.ref}`).set('x-order-token', placed.token)).body;
      const sent = await knex('notifications').where({ status: 'sent' }).count({ n: '*' }).first();
      if (order.status === 'in_design' && sent.n === '4') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(order.status).toBe('in_design');
    expect(order.payments[0]).toMatchObject({ status: 'confirmed', receiptNo: 'RCT00001' });
    expect(await knex('notifications').where({ status: 'sent' }).count({ n: '*' }).first()).toEqual({ n: '4' });
    // The prompt's lock is gone once it settled.
    expect(await redis.exists(`nb:stk:lock:${placed.ref}`)).toBe(0);
  });
});
