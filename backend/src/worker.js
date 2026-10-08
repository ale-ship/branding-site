// @ts-check
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { parseConfig } from './config.js';
import { buildDeps } from './deps.js';
import { runJob } from './jobs/handlers/index.js';
import { PREFIX, QUEUE } from './jobs/queues.js';
import { createLogger } from './lib/logger.js';

/**
 * The worker (docs/BACKEND_RUNBOOK.md, section 4): runs the jobs the API queues after its
 * transactions commit (settle a callback, route a Paybill payment, ask Absa about a silent prompt,
 * send a message) and the repeating ones (expire unpaid orders every 15 minutes, sweep the outbox
 * every minute). A separate process (`npm run worker`; the unit `noorcom-branding-worker` on the VPS).
 */
const config = parseConfig();
const logger = createLogger({ env: config.env, level: config.logLevel }).child({ process: 'worker' });
if (!config.redisUrl || !config.databaseUrl) {
  logger.fatal('the worker needs DATABASE_URL and REDIS_URL');
  process.exit(1);
}

const deps = buildDeps(config, logger);
await deps.redis?.connect().catch((err) => logger.warn({ err }, 'redis not reachable yet, retrying'));
await deps.jobs?.schedule('expire-unpaid', 15 * 60_000);
await deps.jobs?.schedule('outbox-sweep', 60_000);

// Workers block on Redis, so their connection never gives up on a command (BullMQ's rule).
const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
const worker = new Worker(
  QUEUE,
  async (job) => {
    const result = await runJob({ ...deps, logger: logger.child({ job: job.name, jobId: job.id }) }, job.name, job.data);
    return result;
  },
  { connection, prefix: PREFIX, concurrency: 5 },
);
worker.on('completed', (job, result) => {
  if (job.name !== 'outbox-sweep' || result) logger.info({ job: job.name, jobId: job.id, result }, 'job done');
});
worker.on('failed', (job, err) => logger.warn({ err, job: job?.name, jobId: job?.id, attempts: job?.attemptsMade }, 'job failed'));
worker.on('error', (err) => logger.warn({ err }, 'worker error'));
logger.info({ integrations: config.integrations }, 'worker started');

/** @param {string} signal */
async function shutdown(signal) {
  logger.info({ signal }, 'worker stopping');
  await worker.close();
  connection.disconnect();
  await deps.close();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
