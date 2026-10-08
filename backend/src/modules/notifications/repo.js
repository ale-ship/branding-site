// @ts-check

/**
 * The outbox's SQL (`notifications`, migration 002): messages written with the event that caused
 * them, sent by the worker after commit.
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

/**
 * @param {Db} db
 * @param {number} id
 * @returns {Promise<Row | null>}
 */
export async function findNotification(db, id) {
  const { rows } = await db.query('SELECT * FROM notifications WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @param {number} id
 * @param {Date} at
 */
export async function markSent(db, id, at) {
  await db.query("UPDATE notifications SET status = 'sent', sent_at = $2, attempts = attempts + 1 WHERE id = $1", [id, at]);
}

/**
 * Counts a failed try; after `maxAttempts` the message is given up on (status `failed`).
 * @param {Db} db
 * @param {number} id
 * @param {number} maxAttempts
 * @returns {Promise<number>} The attempts so far.
 */
export async function markAttempt(db, id, maxAttempts) {
  const { rows } = await db.query(
    "UPDATE notifications SET attempts = attempts + 1, status = CASE WHEN attempts + 1 >= $2 THEN 'failed' ELSE status END WHERE id = $1 RETURNING attempts",
    [id, maxAttempts],
  );
  return rows[0]?.attempts ?? 0;
}

/**
 * Messages still waiting that were written before `before`: the sweep queues them again.
 * @param {Db} db
 * @param {Date} before
 * @returns {Promise<number[]>}
 */
export async function pendingBefore(db, before) {
  const { rows } = await db.query("SELECT id FROM notifications WHERE status = 'pending' AND created_at < $1 ORDER BY id LIMIT 500", [before]);
  return rows.map((r) => r.id);
}
