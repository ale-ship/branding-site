// @ts-check
import { createApp } from './app.js';
import { parseConfig } from './config.js';
import { buildDeps } from './deps.js';
import { createLogger } from './lib/logger.js';

/**
 * Entry point: builds the app, listens on 127.0.0.1:4300 (nginx is the only way in) and shuts down
 * cleanly on SIGTERM, which systemd sends on a deploy. The jobs it queues run in the worker
 * (src/worker.js).
 */
const config = parseConfig();
const logger = createLogger({ env: config.env, level: config.logLevel });

// In development the API starts without Postgres or Redis and reports them `down` on /api/health;
// production refuses to start without them (config.js).
const deps = buildDeps(config, logger);
if (!deps.pool) logger.warn('DATABASE_URL is not set: running without Postgres');
if (!deps.redis) logger.warn('REDIS_URL is not set: running without Redis (rate limits, payments and messages are off)');
// Not awaited: the API starts and reports `degraded` until Redis answers.
deps.redis?.connect().catch((err) => logger.warn({ err }, 'redis not reachable yet, retrying'));

const app = createApp(config, { ...deps, logger, redis: deps.redis });
const server = app.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port, build: config.build || 'dev', integrations: config.integrations }, 'api listening');
});

/** @param {string} signal */
async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await deps.close();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
