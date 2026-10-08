// @ts-check

/**
 * Staff accounts, their sessions and the audit log (docs/BACKEND_RUNBOOK.md, step B4).
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {{ id: number; email: string; name: string; role: string; active: boolean }} Staff
 * @typedef {Record<string, any>} Row
 */

const PUBLIC = 'id, email, name, role, active';

/**
 * @param {Db} db
 * @param {string} email
 * @returns {Promise<(Staff & { password_hash: string }) | null>}
 */
export async function findByEmail(db, email) {
  const { rows } = await db.query(`SELECT ${PUBLIC}, password_hash FROM staff_users WHERE email = $1`, [email]);
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @param {{ email: string; name: string; role: string; passwordHash: string }} s
 * @returns {Promise<Staff | null>} Null when the email is taken.
 */
export async function insertStaff(db, s) {
  const { rows } = await db.query(
    `INSERT INTO staff_users (email, name, role, password_hash) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING RETURNING ${PUBLIC}`,
    [s.email, s.name, s.role, s.passwordHash],
  );
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @returns {Promise<Staff[]>}
 */
export async function listStaff(db) {
  const { rows } = await db.query(`SELECT ${PUBLIC} FROM staff_users ORDER BY active DESC, name`);
  return rows;
}

/**
 * @param {Db} db
 * @param {number} id
 * @param {{ name?: string; role?: string; active?: boolean; passwordHash?: string }} change
 * @returns {Promise<Staff | null>}
 */
export async function updateStaff(db, id, change) {
  const { rows } = await db.query(
    `UPDATE staff_users SET name = COALESCE($2, name), role = COALESCE($3, role), active = COALESCE($4, active),
       password_hash = COALESCE($5, password_hash), updated_at = now()
     WHERE id = $1 RETURNING ${PUBLIC}`,
    [id, change.name ?? null, change.role ?? null, change.active ?? null, change.passwordHash ?? null],
  );
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @returns {Promise<number>}
 */
export async function countActiveAdmins(db) {
  const { rows } = await db.query("SELECT count(*)::integer AS n FROM staff_users WHERE role = 'admin' AND active");
  return rows[0].n;
}

// ── Sessions ────────────────────────────────────────────────────────────────

/**
 * @param {Db} db
 * @param {string} tokenHash
 * @param {number} staffId
 * @param {Date} expiresAt
 */
export async function insertSession(db, tokenHash, staffId, expiresAt) {
  await db.query('INSERT INTO staff_sessions (token_hash, staff_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, staffId, expiresAt]);
}

/**
 * The session's staff member, if the session is live and the account active; slides the expiry.
 * @param {Db} db
 * @param {string} tokenHash
 * @param {Date} now
 * @param {Date} expiresAt The new expiry.
 * @returns {Promise<Staff | null>}
 */
export async function useSession(db, tokenHash, now, expiresAt) {
  const { rows } = await db.query(
    `WITH s AS (
       UPDATE staff_sessions SET last_seen = $2, expires_at = $3
       WHERE token_hash = $1 AND expires_at > $2 RETURNING staff_id
     )
     SELECT u.id, u.email, u.name, u.role, u.active FROM s JOIN staff_users u ON u.id = s.staff_id WHERE u.active`,
    [tokenHash, now, expiresAt],
  );
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @param {string} tokenHash
 */
export async function deleteSession(db, tokenHash) {
  await db.query('DELETE FROM staff_sessions WHERE token_hash = $1', [tokenHash]);
}

/**
 * Signs a staff member out everywhere (deactivated, or their password changed).
 * @param {Db} db
 * @param {number} staffId
 */
export async function deleteSessionsOf(db, staffId) {
  await db.query('DELETE FROM staff_sessions WHERE staff_id = $1', [staffId]);
}

// ── Audit ───────────────────────────────────────────────────────────────────

/**
 * @param {Db} db
 * @param {number | null} staffId
 * @param {string} action
 * @param {number | null} orderId
 * @param {Record<string, unknown>} [detail]
 */
export async function audit(db, staffId, action, orderId, detail = {}) {
  await db.query('INSERT INTO audit_log (staff_id, action, order_id, detail) VALUES ($1, $2, $3, $4)', [staffId, action, orderId, JSON.stringify(detail)]);
}

/**
 * An order's audit trail with who did what, newest first.
 * @param {Db} db
 * @param {number} orderId
 * @returns {Promise<Row[]>}
 */
export async function auditOf(db, orderId) {
  const { rows } = await db.query(
    `SELECT a.action, a.detail, a.at, u.name AS staff FROM audit_log a LEFT JOIN staff_users u ON u.id = a.staff_id
     WHERE a.order_id = $1 ORDER BY a.id DESC`,
    [orderId],
  );
  return rows;
}
