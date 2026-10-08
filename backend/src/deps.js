// @ts-check
import { createPool } from './db/pool.js';
import { createAbsa } from './integrations/absa/index.js';
import { createMailer } from './integrations/mailer/index.js';
import { createStorage } from './integrations/storage/index.js';
import { createWhatsApp } from './integrations/whatsapp/index.js';
import { createJobs } from './jobs/queues.js';
import { createRedis } from './redis.js';

/**
 * What the API and the worker are built from, made once from the config (docs/BACKEND_RUNBOOK.md,
 * section 4). Services take these as their first argument; tests pass their own (a fake job queue,
 * an Absa fake that answers at once). Anything a service needs and doesn't get, it answers 503 for.
 *
 * @typedef {object} Deps
 * @property {import('pg').Pool | null} pool Null in development without DATABASE_URL.
 * @property {import('ioredis').Redis | null} redis Null in development without REDIS_URL.
 * @property {import('./lib/logger.js').Logger} [logger]
 * @property {import('./jobs/queues.js').Jobs | null} [jobs] The queue the worker reads (needs Redis).
 * @property {import('./integrations/absa/index.js').AbsaClient} [absa]
 * @property {import('./integrations/whatsapp/index.js').WhatsAppClient} [whatsapp]
 * @property {import('./integrations/mailer/index.js').Mailer} [mailer]
 * @property {import('./integrations/storage/index.js').Storage} [storage]
 * @property {import('./config.js').Config} [config]
 */

/**
 * @param {import('./config.js').Config} config
 * @param {import('./lib/logger.js').Logger} logger
 * @returns {Deps & { close: () => Promise<void> }}
 */
export function buildDeps(config, logger) {
  const pool = config.databaseUrl ? createPool(config.databaseUrl) : null;
  const redis = config.redisUrl ? createRedis(config.redisUrl, logger) : null;
  const jobs = config.redisUrl ? createJobs(config.redisUrl) : null;
  // The fake Absa answers through our own callback route, as Absa will.
  const callbackUrl = `http://${config.host}:${config.port}/api/payments/absa/stk/${config.absa.secret}`;
  const absa = createAbsa(config.integrations.absa, {
    redis,
    logger,
    delayMs: config.absa.fakeDelayMs,
    deliver: (body) => fetch(callbackUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  return {
    pool,
    redis,
    logger,
    jobs,
    absa,
    whatsapp: createWhatsApp(config.whatsapp),
    mailer: createMailer(config.mail),
    storage: createStorage(config.files),
    config,
    async close() {
      await Promise.allSettled([pool?.end(), redis?.quit(), jobs?.close()]);
    },
  };
}
