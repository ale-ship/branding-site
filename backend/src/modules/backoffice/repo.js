// @ts-check

/**
 * The back office's SQL (docs/BACKEND_RUNBOOK.md, step B4): the order board, the production log and
 * the order changes staff make.
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

/**
 * Orders for the board, newest first, with what a card shows. `status` filters to those statuses;
 * `q` matches the order number, the customer's name, phone or email.
 * @param {Db} db
 * @param {{ statuses?: string[]; q?: string; mechanism?: string; limit?: number }} f
 * @returns {Promise<Row[]>}
 */
export async function board(db, { statuses, q, mechanism, limit = 300 }) {
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  const { rows } = await db.query(
    `SELECT o.order_no, o.created_at, o.status, o.mechanism, o.product, o.quantity, o.urgency, o.handover,
       o.customer_name, o.customer_company, o.customer_phone, o.total, o.amount_paid, o.due_now, o.credit,
       o.progress, o.promised_date, o.estimate->>'readyBy' AS ready_by, o.attention, o.expires_at
     FROM orders o
     WHERE ($1::text[] IS NULL OR o.status = ANY($1))
       AND ($2::text IS NULL OR o.mechanism = $2)
       AND ($3::text IS NULL OR o.order_no ILIKE $3 OR o.customer_name ILIKE $3 OR o.customer_phone ILIKE $3 OR o.customer_email ILIKE $3)
     ORDER BY o.created_at DESC
     LIMIT $4`,
    [statuses?.length ? statuses : null, mechanism ?? null, like, limit],
  );
  return rows;
}

/**
 * @param {Db} trx
 * @param {{ orderId: number; pieces: number; note: string; staffId: number; at: Date }} l
 */
export async function insertLog(trx, l) {
  await trx.query('INSERT INTO production_logs (order_id, pieces, note, staff_id, at) VALUES ($1, $2, $3, $4, $5)', [l.orderId, l.pieces, l.note, l.staffId, l.at]);
}

/** @typedef {(v: any) => unknown} Encode */

/** The columns a staff step may set, and how each is sent. @type {Record<string, Encode>} */
const COLUMNS = {
  status: (v) => v,
  progress: (v) => JSON.stringify(v),
  pickup_code: (v) => v,
  dispatch: (v) => (v == null ? null : JSON.stringify(v)),
  handed_over: (v) => (v == null ? null : JSON.stringify(v)),
  due_now: (v) => v,
  due_purpose: (v) => v,
  expires_at: (v) => v,
  attention: (v) => v,
  started_on: (v) => v,
  promised_date: (v) => v,
};

/**
 * Sets the given columns (only those in COLUMNS) and `updated_at`.
 * @param {Db} trx
 * @param {number} orderId
 * @param {Record<string, unknown>} fields
 * @param {Date} at
 */
export async function updateOrder(trx, orderId, fields, at) {
  const entries = Object.entries(fields).filter(([k]) => Object.hasOwn(COLUMNS, k));
  if (!entries.length) return;
  const sets = entries.map(([k], i) => `${k} = $${i + 3}`).join(', ');
  const values = entries.map(([k, v]) => /** @type {Encode} */ (COLUMNS[k])(v));
  await trx.query(`UPDATE orders SET ${sets}, updated_at = $2 WHERE id = $1`, [orderId, at, ...values]);
}
