// @ts-check

/**
 * Customer accounts' SQL (migration 009): sign-in codes, sessions and profiles. Companies are in
 * company.repo.js. Codes and session tokens are stored only as their hashes.
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

/**
 * Stores a new code for the email unless one was sent in the last `resendSec` seconds.
 * @param {Db} db
 * @param {{ email: string; codeHash: string; now: Date; expiresAt: Date; resendSec: number }} c
 * @returns {Promise<boolean>} False when it is too soon for another.
 */
export async function putCode(db, { email, codeHash, now, expiresAt, resendSec }) {
  const { rowCount } = await db.query(
    `INSERT INTO sign_in_codes (email, code_hash, tries, sent_at, expires_at) VALUES ($1, $2, 0, $3, $4)
     ON CONFLICT (email) DO UPDATE SET code_hash = $2, tries = 0, sent_at = $3, expires_at = $4
     WHERE sign_in_codes.sent_at <= $3::timestamptz - make_interval(secs => $5)`,
    [email, codeHash, now, expiresAt, resendSec],
  );
  return rowCount === 1;
}

/**
 * @param {Db} db
 * @param {string} email
 * @returns {Promise<Date | null>}
 */
export async function codeSentAt(db, email) {
  const { rows } = await db.query('SELECT sent_at FROM sign_in_codes WHERE email = $1', [email]);
  return rows[0]?.sent_at ?? null;
}

/**
 * @param {Db} db
 * @param {string} email
 */
export async function deleteCode(db, email) {
  await db.query('DELETE FROM sign_in_codes WHERE email = $1', [email]);
}

/**
 * Counts a try against the email's live code; null when there is none left to try.
 * @param {Db} db
 * @param {string} email
 * @param {Date} now
 * @param {number} maxTries
 * @returns {Promise<string | null>} The code's hash.
 */
export async function tryCode(db, email, now, maxTries) {
  const { rows } = await db.query(
    `UPDATE sign_in_codes SET tries = tries + 1
     WHERE email = $1 AND expires_at > $2 AND tries < $3
     RETURNING code_hash`,
    [email, now, maxTries],
  );
  return rows[0]?.code_hash ?? null;
}

/**
 * Uses the code up: only one sign-in can claim it, however many arrive at once.
 * @param {Db} db
 * @param {string} email
 * @param {string} codeHash
 * @returns {Promise<boolean>}
 */
export async function claimCode(db, email, codeHash) {
  const { rowCount } = await db.query('DELETE FROM sign_in_codes WHERE email = $1 AND code_hash = $2', [email, codeHash]);
  return rowCount === 1;
}

/**
 * A new session, clearing the email's expired ones.
 * @param {Db} db
 * @param {{ tokenHash: string; email: string; now: Date; expiresAt: Date }} s
 */
export async function insertSession(db, { tokenHash, email, now, expiresAt }) {
  await db.query('DELETE FROM customer_sessions WHERE email = $1 AND expires_at <= $2', [email, now]);
  await db.query('INSERT INTO customer_sessions (token_hash, email, created_at, expires_at) VALUES ($1, $2, $3, $4)', [tokenHash, email, now, expiresAt]);
}

/**
 * @param {Db} db
 * @param {string} tokenHash
 * @param {Date} now
 * @returns {Promise<string | null>} The session's email, while it lasts.
 */
export async function sessionEmail(db, tokenHash, now) {
  const { rows } = await db.query('SELECT email FROM customer_sessions WHERE token_hash = $1 AND expires_at > $2', [tokenHash, now]);
  return rows[0]?.email ?? null;
}

/**
 * @param {Db} db
 * @param {string} tokenHash
 */
export async function deleteSession(db, tokenHash) {
  await db.query('DELETE FROM customer_sessions WHERE token_hash = $1', [tokenHash]);
}

/**
 * The profile, made on first use from the customer's latest order, so they don't type it all again.
 * @param {Db} db
 * @param {string} email
 * @returns {Promise<Row>}
 */
export async function profileOf(db, email) {
  await db.query(
    `INSERT INTO customer_profiles (email, name, phone, company)
     SELECT $1, COALESCE(o.customer_name, ''), COALESCE(o.customer_phone, ''), COALESCE(o.customer_company, '')
     FROM (SELECT 1) one
     LEFT JOIN LATERAL (SELECT * FROM orders WHERE customer_email = $1 ORDER BY created_at DESC, id DESC LIMIT 1) o ON true
     ON CONFLICT (email) DO NOTHING`,
    [email],
  );
  const { rows } = await db.query('SELECT * FROM customer_profiles WHERE email = $1', [email]);
  return rows[0];
}

/**
 * @param {Db} db
 * @param {string} email
 * @param {{ name?: string; phone?: string; company?: string; brandKit?: unknown; addresses?: unknown }} change
 */
export async function updateProfile(db, email, change) {
  const { rows } = await db.query(
    `UPDATE customer_profiles SET
       name = COALESCE($2, name), phone = COALESCE($3, phone), company = COALESCE($4, company),
       brand_kit = CASE WHEN $5::boolean THEN $6::jsonb ELSE brand_kit END,
       addresses = COALESCE($7::jsonb, addresses), updated_at = now()
     WHERE email = $1 RETURNING *`,
    [
      email,
      change.name ?? null,
      change.phone ?? null,
      change.company ?? null,
      change.brandKit !== undefined,
      change.brandKit === undefined ? null : JSON.stringify(change.brandKit),
      change.addresses === undefined ? null : JSON.stringify(change.addresses),
    ],
  );
  return rows[0];
}

const SUMMARY = `
  SELECT o.order_no, o.created_at, o.status, o.product, o.mechanism, o.quantity, o.total, o.amount_paid, o.credit,
         o.customer_name, o.customer_phone, o.customer_company, i.invoice_no,
         EXISTS (SELECT 1 FROM proofs p WHERE p.order_id = o.id AND p.status = 'approved') AS approved
  FROM orders o JOIN invoices i ON i.order_id = o.id`;

/**
 * Every order placed with the email, newest first.
 * @param {Db} db
 * @param {string} email
 * @returns {Promise<Row[]>}
 */
export async function ordersOf(db, email) {
  const { rows } = await db.query(`${SUMMARY} WHERE o.customer_email = $1 ORDER BY o.created_at DESC, o.id DESC`, [email]);
  return rows;
}

/**
 * The company's orders placed by other members, newest first.
 * @param {Db} db
 * @param {string} companyId
 * @param {string} email
 * @returns {Promise<Row[]>}
 */
export async function companyOrders(db, companyId, email) {
  const { rows } = await db.query(`${SUMMARY} WHERE o.company_id = $1 AND o.customer_email <> $2 ORDER BY o.created_at DESC, o.id DESC`, [companyId, email]);
  return rows;
}

/**
 * One of the email's orders, whole, with its newest approved proof.
 * @param {Db} db
 * @param {string} email
 * @param {string} orderNo
 * @returns {Promise<Row | null>}
 */
export async function ownOrder(db, email, orderNo) {
  const { rows } = await db.query(
    `SELECT o.*, (SELECT max(version) FROM proofs p WHERE p.order_id = o.id AND p.status = 'approved') AS approved_version
     FROM orders o WHERE o.order_no = $1 AND o.customer_email = $2`,
    [orderNo, email],
  );
  return rows[0] ?? null;
}
