// @ts-check
import pg from 'pg';

/**
 * Postgres through `pg` (docs/BACKEND_RUNBOOK.md, section 2): repos take a client or transaction as
 * their first argument; services open transactions with `withTransaction`. Money is whole shillings
 * in integer columns.
 */

// A `date` column comes back as its YYYY-MM-DD text, never a JavaScript Date. BIGINT stays a string.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

/** @typedef {pg.Pool} Pool */
/** @typedef {pg.PoolClient} Client */

/**
 * @param {string} connectionString
 * @param {{ max?: number }} [options]
 * @returns {Pool}
 */
export function createPool(connectionString, { max = 10 } = {}) {
  return new pg.Pool({ connectionString, max, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 3000 });
}

/**
 * Runs `fn(client)` in one transaction and returns its result; rolls back on any error.
 * @template T
 * @param {Pool} pool
 * @param {(client: Client) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * @param {Pick<Pool, 'query'> | null} pool
 * @returns {Promise<boolean>}
 */
export async function dbHealthy(pool) {
  if (!pool) return false;
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
    const result = /** @type {{ rows: { ok: number }[] }} */ (await Promise.race([pool.query('SELECT 1 AS ok'), timeout]));
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}
