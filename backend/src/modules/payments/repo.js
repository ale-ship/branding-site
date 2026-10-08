// @ts-check

/**
 * The payments' SQL (docs/BACKEND_RUNBOOK.md, step B3): prompts, payments, raw provider bodies and
 * Paybill confirmations. Every function takes the client or transaction first.
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

/** @param {unknown} v */
const json = (v) => (v == null ? null : JSON.stringify(v));

// ── Prompts (STK Push) ───────────────────────────────────────────────────────

/**
 * @param {Db} db
 * @param {number} orderId
 * @returns {Promise<Row | null>}
 */
export async function pendingRequest(db, orderId) {
  const { rows } = await db.query("SELECT * FROM payment_requests WHERE order_id = $1 AND status = 'pending'", [orderId]);
  return rows[0] ?? null;
}

/**
 * A new pending prompt; null if the order already has one (the partial unique index) or the id clashes.
 * @param {Db} db
 * @param {{ publicId: string; orderId: number; provider: string; purpose: string; phone: string; amount: number; timeoutAt: Date; at: Date }} r
 * @returns {Promise<Row | null>}
 */
export async function insertRequest(db, r) {
  const { rows } = await db.query(
    `INSERT INTO payment_requests (public_id, order_id, provider, purpose, phone, amount, timeout_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING RETURNING *`,
    [r.publicId, r.orderId, r.provider, r.purpose, r.phone, r.amount, r.timeoutAt, r.at],
  );
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @param {number} id
 * @param {string} providerRequestId
 */
export async function setProviderRequestId(db, id, providerRequestId) {
  await db.query('UPDATE payment_requests SET provider_request_id = $2 WHERE id = $1', [id, providerRequestId]);
}

/**
 * @param {Db} db
 * @param {{ id?: number; providerRequestId?: string }} by
 * @param {{ lock?: boolean }} [options]
 * @returns {Promise<Row | null>}
 */
export async function findRequest(db, by, { lock = false } = {}) {
  const where = by.id !== undefined ? 'id = $1' : 'provider_request_id = $1';
  const { rows } = await db.query(`SELECT * FROM payment_requests WHERE ${where} ${lock ? 'FOR UPDATE' : ''}`, [by.id ?? by.providerRequestId]);
  return rows[0] ?? null;
}

/**
 * Closes a pending prompt. Returns false when it was no longer pending (already settled).
 * @param {Db} db
 * @param {number} id
 * @param {'confirmed' | 'failed' | 'cancelled' | 'timeout'} status
 * @param {string | null} message
 * @param {Date} at
 */
export async function closeRequest(db, id, status, message, at) {
  const { rowCount } = await db.query(
    "UPDATE payment_requests SET status = $2, message = $3, settled_at = $4 WHERE id = $1 AND status = 'pending'",
    [id, status, message, at],
  );
  return rowCount === 1;
}

// ── Payments and the order they credit (the ledger) ──────────────────────────

/**
 * The order's money, locked for the ledger's transaction.
 * @param {Db} trx
 * @param {number} orderId
 * @returns {Promise<Row | null>}
 */
export async function lockOrder(trx, orderId) {
  const { rows } = await trx.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @param {number} orderId
 * @returns {Promise<string>}
 */
export async function orderNoOf(db, orderId) {
  const { rows } = await db.query('SELECT order_no FROM orders WHERE id = $1', [orderId]);
  return rows[0]?.order_no ?? '';
}

/**
 * @param {Db} db
 * @param {string} mpesaReceipt
 */
export async function receiptSeen(db, mpesaReceipt) {
  const { rowCount } = await db.query('SELECT 1 FROM payments WHERE mpesa_receipt = $1', [mpesaReceipt]);
  return rowCount === 1;
}

/**
 * @param {Db} trx
 * @param {{ publicId: string; orderId: number; requestId: number | null; purpose: string; method: string; phone: string | null; amount: number; mpesaReceipt: string; receiptNo: string; raw: unknown; at: Date }} p
 */
export async function insertPayment(trx, p) {
  await trx.query(
    `INSERT INTO payments (public_id, order_id, request_id, purpose, method, phone, amount, mpesa_receipt, receipt_no, raw, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [p.publicId, p.orderId, p.requestId, p.purpose, p.method, p.phone, p.amount, p.mpesaReceipt, p.receiptNo, json(p.raw), p.at],
  );
}

/**
 * Writes what the ledger worked out (apply.js) back to the order.
 * @param {Db} trx
 * @param {number} orderId
 * @param {import('./apply.js').Applied} a
 * @param {Date} at
 */
export async function updateOrderMoney(trx, orderId, a, at) {
  await trx.query(
    `UPDATE orders SET status = $2, amount_paid = $3, credit = $4, due_now = $5, due_purpose = $6,
       expires_at = CASE WHEN $7 THEN NULL ELSE expires_at END,
       started_on = COALESCE($8, started_on), promised_date = COALESCE($9, promised_date),
       attention = COALESCE($10, attention), updated_at = $11
     WHERE id = $1`,
    [orderId, a.status, a.amountPaid, a.credit, a.dueNow, a.duePurpose, a.stopExpiry, a.production?.startedOn ?? null, a.production?.promisedDate ?? null, a.attention, at],
  );
}

// ── What providers sent ──────────────────────────────────────────────────────

/**
 * @param {Db} db
 * @param {string} kind
 * @param {unknown} body
 * @returns {Promise<number>}
 */
export async function storeCallback(db, kind, body) {
  const { rows } = await db.query('INSERT INTO provider_callbacks (kind, body) VALUES ($1, $2) RETURNING id', [kind, json(body ?? {})]);
  return rows[0].id;
}

/**
 * @param {Db} db
 * @param {number} id
 * @returns {Promise<Row | null>}
 */
export async function findCallback(db, id) {
  const { rows } = await db.query('SELECT * FROM provider_callbacks WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @param {number} id
 * @param {string} result
 */
export async function markCallback(db, id, result) {
  await db.query('UPDATE provider_callbacks SET result = $2, processed_at = now() WHERE id = $1', [id, result]);
}
