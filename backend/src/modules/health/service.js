// @ts-check
import { dbHealthy } from '../../db/pool.js';
import { redisHealthy } from '../../redis.js';

/**
 * @typedef {object} HealthDeps
 * @property {Pick<import('pg').Pool, 'query'> | null} pool
 * @property {Pick<import('ioredis').Redis, 'status' | 'ping'> | null} redis
 * @property {string} build
 * @property {Record<string, string>} integrations
 */

/**
 * What the deploy script and monitoring poll (docs/BACKEND_RUNBOOK.md, section 10): is the API up,
 * and can it reach Postgres and Redis. `degraded` while either is down.
 * @param {HealthDeps} deps
 */
export async function healthReport({ pool, redis, build, integrations }) {
  const [db, cache] = await Promise.all([dbHealthy(pool), redisHealthy(redis)]);
  return { status: db && cache ? 'ok' : 'degraded', build, db: db ? 'up' : 'down', redis: cache ? 'up' : 'down', integrations };
}
