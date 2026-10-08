// @ts-check

/**
 * Paybill (C2B) confirmations' SQL (docs/BACKEND_RUNBOOK.md, section 6): stored as received, routed,
 * and the unmatched ones kept for staff.
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

/**
 * Stores a confirmation. Null when its transaction id is already stored (a repeat, acknowledged and
 * dropped).
 * @param {Db} db
 * @param {string} transId
 * @param {unknown} body
 * @returns {Promise<number | null>}
 */
export async function insertConfirmation(db, transId, body) {
  const { rows } = await db.query(
    'INSERT INTO c2b_confirmations (trans_id, body) VALUES ($1, $2) ON CONFLICT (trans_id) DO NOTHING RETURNING id',
    [transId, JSON.stringify(body)],
  );
  return rows[0]?.id ?? null;
}

/**
 * @param {Db} db
 * @param {number} id
 * @param {{ lock?: boolean }} [options]
 * @returns {Promise<Row | null>}
 */
export async function findConfirmation(db, id, { lock = false } = {}) {
  const { rows } = await db.query(`SELECT * FROM c2b_confirmations WHERE id = $1 ${lock ? 'FOR UPDATE' : ''}`, [id]);
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @param {number} id
 * @param {{ status: string; routedBy?: string | null; reason?: string | null; orderId?: number | null; assignedBy?: string | null }} s
 */
export async function settleConfirmation(db, id, s) {
  await db.query(
    `UPDATE c2b_confirmations SET status = $2, routed_by = COALESCE($3, routed_by), reason = $4,
       order_id = COALESCE($5, order_id), assigned_by = COALESCE($6, assigned_by), processed_at = now()
     WHERE id = $1`,
    [id, s.status, s.routedBy ?? null, s.reason ?? null, s.orderId ?? null, s.assignedBy ?? null],
  );
}

/**
 * The orders a confirmation could belong to: the one named in its reference, and the waiting
 * orders of the payer's phone. In the shape `routeC2B` reads, with the order id.
 * @param {Db} db
 * @param {string | null} ref
 * @param {string | null} msisdn
 * @returns {Promise<{ id: number; ref: string; status: string; dueNow: number; customerPhone: string }[]>}
 */
export async function candidates(db, ref, msisdn) {
  const { rows } = await db.query(
    `SELECT id, order_no, status, due_now, customer_phone FROM orders
     WHERE order_no = $1 OR (customer_phone = $2 AND status IN ('awaiting_payment', 'awaiting_balance'))`,
    [ref, msisdn],
  );
  return rows.map((r) => ({ id: r.id, ref: r.order_no, status: r.status, dueNow: r.due_now, customerPhone: r.customer_phone }));
}

/**
 * Unmatched payments, oldest first, for the staff screen (B4).
 * @param {Db} db
 * @returns {Promise<Row[]>}
 */
export async function listUnmatched(db) {
  const { rows } = await db.query("SELECT id, trans_id, body, reason, received_at FROM c2b_confirmations WHERE status = 'unmatched' ORDER BY id");
  return rows;
}

/**
 * @param {Db} db
 * @param {string} orderNo
 * @returns {Promise<number | null>}
 */
export async function orderIdOf(db, orderNo) {
  const { rows } = await db.query('SELECT id FROM orders WHERE order_no = $1', [orderNo]);
  return rows[0]?.id ?? null;
}
