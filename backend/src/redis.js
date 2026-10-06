// @ts-check
import { Redis } from 'ioredis';

/**
 * The one Redis connection (docs/BACKEND_RUNBOOK.md, section 2.2). Every key starts with `nb:`: the
 * Redis ACL user `nb` may touch nothing else, so Noorcom Computers' keys (`ne:*`) on the same server
 * are out of reach. BullMQ gets `prefix: 'nb:bull'` and connections of its own (step B2).
 */

export const PREFIX = 'nb:';

/** @param {...(string | number)} parts */
export const key = (...parts) => `${PREFIX}${parts.join(':')}`;

/**
 * Commands fail fast when Redis is down instead of queueing, so a request never hangs on it.
 * @param {string} url
 * @param {import('./lib/logger.js').Logger} logger
 * @returns {Redis}
 */
export function createRedis(url, logger) {
  const client = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: (n) => Math.min(n * 500, 5000),
  });
  let lastError = '';
  client.on('error', (err) => {
    // Log a repeated failure once, not on every retry.
    if (err.message !== lastError) logger.warn({ err }, 'redis error');
    lastError = err.message;
  });
  client.on('ready', () => {
    lastError = '';
    logger.info('redis ready');
  });
  return client;
}

/**
 * @param {Pick<Redis, 'status' | 'ping'> | null} client
 * @returns {Promise<boolean>}
 */
export async function redisHealthy(client) {
  if (!client || client.status !== 'ready') return false;
  try {
    const pong = await Promise.race([client.ping(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))]);
    return pong === 'PONG';
  } catch {
    return false;
  }
}
