// @ts-check
import { createApp } from './app.js';
import { parseConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createLogger } from './lib/logger.js';
import { createRedis } from './redis.js';

/**
 * Entry point: builds the app, listens on 127.0.0.1:4300 (nginx is the only way in) and shuts down
 * cleanly on SIGTERM, which systemd sends on a deploy.
 */
const config = parseConfig();
const logger = createLogger({ env: config.env, level: config.logLevel });

// In development the API starts without Postgres or Redis and reports them `down` on /api/health;
// production refuses to start without them (config.js).
const pool = config.databaseUrl ? createPool(config.databaseUrl) : null;
const redis = config.redisUrl ? createRedis(config.redisUrl, logger) : null;
if (!pool) logger.warn('DATABASE_URL is not set: running without Postgres');
if (!redis) logger.warn('REDIS_URL is not set: running without Redis (rate limits are off)');
// Not awaited: the API starts and reports `degraded` until Redis answers.
redis?.connect().catch((err) => logger.warn({ err }, 'redis not reachable yet, retrying'));

const app = createApp(config, { logger, pool, redis });
const server = app.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port, build: config.build || 'dev', integrations: config.integrations }, 'api listening');
});

/** @param {string} signal */
async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await Promise.allSettled([pool?.end(), redis?.quit()]);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
