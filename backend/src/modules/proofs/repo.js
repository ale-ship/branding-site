// @ts-check

/**
 * Proofs' SQL (migration 005).
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

/**
 * The order's newest proof, locked when a decision is about to be written.
 * @param {Db} db
 * @param {number} orderId
 * @param {{ lock?: boolean }} [o]
 * @returns {Promise<Row | null>}
 */
export async function latestProof(db, orderId, { lock = false } = {}) {
  const { rows } = await db.query(`SELECT * FROM proofs WHERE order_id = $1 ORDER BY version DESC LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`, [orderId]);
  return rows[0] ?? null;
}

/**
 * @param {Db} trx
 * @param {{ orderId: number; version: number; note: string; fileKey: string; originalKey: string; staffId: number; at: Date }} p
 */
export async function insertProof(trx, p) {
  await trx.query(
    'INSERT INTO proofs (order_id, version, note, file_key, original_key, staff_id, uploaded_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [p.orderId, p.version, p.note, p.fileKey, p.originalKey, p.staffId, p.at],
  );
}

/**
 * @param {Db} trx
 * @param {number} id
 * @param {{ status: 'approved' | 'changes_requested'; comments?: string | null; pins?: unknown[]; checklist?: unknown; at: Date }} d
 */
export async function decide(trx, id, d) {
  await trx.query('UPDATE proofs SET status = $2, comments = $3, pins = $4, checklist = $5, decided_at = $6 WHERE id = $1', [
    id,
    d.status,
    d.comments ?? null,
    JSON.stringify(d.pins ?? []),
    d.checklist ? JSON.stringify(d.checklist) : null,
    d.at,
  ]);
}

/**
 * One version's files, for staff.
 * @param {Db} db
 * @param {string} orderNo
 * @param {number} version
 * @returns {Promise<Row | null>}
 */
export async function proofFiles(db, orderNo, version) {
  const { rows } = await db.query(
    'SELECT p.file_key, p.original_key FROM proofs p JOIN orders o ON o.id = p.order_id WHERE o.order_no = $1 AND p.version = $2',
    [orderNo, version],
  );
  return rows[0] ?? null;
}
