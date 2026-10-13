// @ts-check

/**
 * Requests' SQL (migration 012): quote requests and contact messages for the staff inbox.
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

/**
 * @param {Db} db
 * @param {{ ref: string; kind: 'quote' | 'message'; name: string; company: string; phone: string; email: string; preferredContact: string; data: unknown; at: Date }} r
 * @returns {Promise<number | null>} The new id, or null when the reference is taken (draw another).
 */
export async function insertRequest(db, r) {
  const { rows } = await db.query(
    `INSERT INTO requests (ref, kind, name, company, phone, email, preferred_contact, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) ON CONFLICT (ref) DO NOTHING RETURNING id`,
    [r.ref, r.kind, r.name, r.company, r.phone, r.email, r.preferredContact, JSON.stringify(r.data), r.at],
  );
  return rows[0]?.id ?? null;
}

/**
 * Messages about a request (no order): the staff alert and the customer's acknowledgement.
 * @param {Db} db
 * @param {{ channel: 'whatsapp' | 'email'; recipient: string; template: string; payload: unknown }[]} messages
 * @param {Date} at
 * @returns {Promise<number[]>}
 */
export async function insertMessages(db, messages, at) {
  const ids = [];
  for (const m of messages) {
    const { rows } = await db.query(
      'INSERT INTO notifications (order_id, channel, recipient, template, payload, created_at) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
      [m.channel, m.recipient, m.template, JSON.stringify(m.payload), at],
    );
    ids.push(rows[0].id);
  }
  return ids;
}

/**
 * Newest first, by status and a search over the reference, name, company, phone and email.
 * @param {Db} db
 * @param {{ status?: string; q?: string }} f
 * @returns {Promise<Row[]>}
 */
export async function listRequests(db, { status, q }) {
  const { rows } = await db.query(
    `SELECT r.*, s.name AS handled_by_name FROM requests r LEFT JOIN staff_users s ON s.id = r.handled_by
     WHERE ($1::text IS NULL OR r.status = $1)
       AND ($2::text IS NULL OR r.ref ILIKE '%' || $2 || '%' OR r.name ILIKE '%' || $2 || '%' OR r.company ILIKE '%' || $2 || '%'
            OR r.phone ILIKE '%' || $2 || '%' OR r.email ILIKE '%' || $2 || '%')
     ORDER BY r.created_at DESC, r.id DESC LIMIT 200`,
    [status ?? null, q ?? null],
  );
  return rows;
}

/**
 * @param {Db} db
 * @param {string} ref
 * @returns {Promise<Row | null>}
 */
export async function findRequest(db, ref) {
  const { rows } = await db.query(
    'SELECT r.*, s.name AS handled_by_name FROM requests r LEFT JOIN staff_users s ON s.id = r.handled_by WHERE r.ref = $1',
    [ref],
  );
  return rows[0] ?? null;
}

/**
 * @param {Db} db
 * @param {string} ref
 * @param {{ status?: string; note?: string; staffId: number }} c
 */
export async function updateRequest(db, ref, { status, note, staffId }) {
  const { rowCount } = await db.query(
    `UPDATE requests SET status = COALESCE($2, status), staff_note = COALESCE($3, staff_note), handled_by = $4, updated_at = now()
     WHERE ref = $1`,
    [ref, status ?? null, note ?? null, staffId],
  );
  return rowCount === 1;
}

/**
 * The website's names for services and shop products, by slug, so a request reads in words.
 * @param {Db} db
 * @returns {Promise<Map<string, string>>}
 */
export async function contentNames(db) {
  const { rows } = await db.query("SELECT kind, slug, data->>'name' AS name FROM content_items WHERE kind IN ('service', 'product')");
  return new Map(rows.map((r) => [`${r.kind}:${r.slug}`, r.name]));
}

/**
 * How many are new, for the dashboard.
 * @param {Db} db
 */
export async function newCount(db) {
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM requests WHERE status = 'new'`);
  return rows[0].n;
}
