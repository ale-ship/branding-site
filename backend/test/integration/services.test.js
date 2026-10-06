import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { createPool, dbHealthy, withTransaction } from '../../src/db/pool.js';
import { createLogger } from '../../src/lib/logger.js';
import { createRedis, key, redisHealthy } from '../../src/redis.js';

/**
 * Against the real services, when the test database and Redis are set in backend/.env
 * (TEST_DATABASE_URL, TEST_REDIS_URL). Skipped otherwise, so a machine without them still runs the
 * rest; CI and the VPS staging check always set them.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
const logger = createLogger({ env: 'test' });

describe.skipIf(!dbUrl)('Postgres', () => {
  const pool = dbUrl ? createPool(dbUrl) : null;
  afterAll(() => pool?.end());

  it('answers, and rolls a failed transaction back', async () => {
    expect(await dbHealthy(pool)).toBe(true);
    await pool.query('CREATE TEMP TABLE IF NOT EXISTS b0_check (n int)');
    const client = await pool.connect();
    client.release();
    await expect(
      withTransaction(pool, async (tx) => {
        await tx.query('CREATE TABLE b0_rollback_check (n int)');
        throw new Error('stop');
      }),
    ).rejects.toThrow('stop');
    const { rows } = await pool.query("SELECT to_regclass('b0_rollback_check') AS t");
    expect(rows[0].t).toBeNull();
  });

  it('returns date columns as YYYY-MM-DD text', async () => {
    const { rows } = await pool.query("SELECT DATE '2026-10-06' AS d");
    expect(rows[0].d).toBe('2026-10-06');
  });
});

describe.skipIf(!redisUrl)('Redis', () => {
  const redis = redisUrl ? createRedis(redisUrl, logger) : null;
  afterAll(() => redis?.quit());

  it('connects as the nb user and works under nb:*', async () => {
    await redis.connect();
    expect(await redisHealthy(redis)).toBe(true);
    const k = key('test', 'b0', Date.now());
    expect(k.startsWith('nb:test:b0:')).toBe(true);
    await redis.set(k, '1', 'EX', 10);
    expect(await redis.get(k)).toBe('1');
    await redis.del(k);
  });
});
