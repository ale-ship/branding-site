// @ts-check

/**
 * The orders' SQL (docs/BACKEND_RUNBOOK.md, step B2): orders, their events, invoices and the
 * notification outbox. Rows come back as plain objects for view.js to shape into an `Order`.
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

/** JSONB parameters go as text: `pg` would send a JS array as a Postgres array. @param {unknown} v */
const json = (v) => (v == null ? null : JSON.stringify(v));

/**
 * The order row as placed. Null when the order number is taken (the caller draws another).
 * @param {Db} trx
 * @param {Row} o
 * @returns {Promise<number | null>}
 */
export async function insertOrder(trx, o) {
  const { rows } = await trx.query(
    `INSERT INTO orders (order_no, token_hash, status, mechanism, product_id, product, quantity, brief, common,
       needs_design, urgency, handover, customer_name, customer_company, customer_phone, customer_email,
       estimate, total, due_now, due_purpose, progress, survey, sample, daily_capacity, expires_at, created_at, updated_at)
     VALUES ($1, $2, 'awaiting_payment', $3, (SELECT id FROM products WHERE slug = $4), $5, $6, $7, $8,
       $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $25)
     ON CONFLICT (order_no) DO NOTHING
     RETURNING id`,
    [
      o.orderNo, o.tokenHash, o.mechanism, o.product.slug, json(o.product), o.quantity, json(o.brief), json(o.common),
      o.needsDesign, o.urgency, json(o.handover), o.customer.name, o.customer.company, o.customer.phone, o.customer.email,
      json(o.estimate), o.total, o.dueNow, o.duePurpose, json(o.progress), json(o.survey), json(o.sample), o.dailyCapacity, o.expiresAt,
      o.createdAt,
    ],
  );
  return rows[0]?.id ?? null;
}

/**
 * @param {Db} trx
 * @param {number} orderId
 * @param {{ invoiceNo: string; lines: unknown; subtotal: number; total: number | null }} invoice
 */
export async function insertInvoice(trx, orderId, { invoiceNo, lines, subtotal, total }) {
  await trx.query('INSERT INTO invoices (invoice_no, order_id, lines, subtotal, total) VALUES ($1, $2, $3, $4, $5)', [
    invoiceNo, orderId, JSON.stringify(lines), subtotal, total,
  ]);
}

/**
 * @param {Db} trx
 * @param {number} orderId
 * @param {string} text
 * @param {Date} at
 */
export async function insertEvent(trx, orderId, text, at) {
  await trx.query('INSERT INTO order_events (order_id, text, at) VALUES ($1, $2, $3)', [orderId, text, at]);
}

/**
 * Outbox rows, written in the event's own transaction and delivered after commit.
 * @param {Db} trx
 * @param {number} orderId
 * @param {{ channel: 'whatsapp' | 'email'; recipient: string; template: string; payload: unknown }[]} messages
 * @param {Date} at
 * @returns {Promise<number[]>} The new rows' ids, for the caller to queue after commit.
 */
export async function insertNotifications(trx, orderId, messages, at) {
  const ids = [];
  for (const m of messages) {
    const { rows } = await trx.query(
      'INSERT INTO notifications (order_id, channel, recipient, template, payload, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [orderId, m.channel, m.recipient, m.template, JSON.stringify(m.payload), at],
    );
    ids.push(rows[0].id);
  }
  return ids;
}

/**
 * The order with its invoice number, or null. `FOR UPDATE` when a transaction will change it.
 * @param {Db} db
 * @param {string} orderNo
 * @param {{ lock?: boolean }} [options]
 * @returns {Promise<Row | null>}
 */
export async function findByOrderNo(db, orderNo, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT o.*, i.invoice_no FROM orders o LEFT JOIN invoices i ON i.order_id = o.id
     WHERE o.order_no = $1 ${lock ? 'FOR UPDATE OF o' : ''}`,
    [orderNo],
  );
  return rows[0] ?? null;
}

/**
 * The order's events, the messages sent about it, its prompts, its payments and its production
 * log, oldest first.
 * @param {Db} db
 * @param {number} orderId
 * @returns {Promise<{ events: Row[]; notifications: Row[]; requests: Row[]; payments: Row[]; logs: Row[] }>}
 */
export async function historyOf(db, orderId) {
  const [events, notifications, requests, payments, logs] = await Promise.all([
    db.query('SELECT text, at FROM order_events WHERE order_id = $1 ORDER BY id', [orderId]),
    db.query('SELECT channel, recipient, payload, created_at FROM notifications WHERE order_id = $1 ORDER BY id', [orderId]),
    db.query('SELECT * FROM payment_requests WHERE order_id = $1 ORDER BY id', [orderId]),
    db.query('SELECT id, public_id, request_id, purpose, method, phone, amount, mpesa_receipt, receipt_no, created_at FROM payments WHERE order_id = $1 ORDER BY id', [orderId]),
    db.query('SELECT pieces, note, at FROM production_logs WHERE order_id = $1 ORDER BY id', [orderId]),
  ]);
  return { events: events.rows, notifications: notifications.rows, requests: requests.rows, payments: payments.rows, logs: logs.rows };
}

/**
 * Expires unpaid orders past their time (one order when `orderId` is given) and returns their ids.
 * Nothing is due on an expired order any more.
 * @param {Db} trx
 * @param {Date} now
 * @param {number} [orderId]
 * @returns {Promise<number[]>}
 */
export async function expireUnpaid(trx, now, orderId) {
  const { rows } = await trx.query(
    `UPDATE orders SET status = 'expired', due_now = 0, due_purpose = NULL, updated_at = $1
     WHERE status = 'awaiting_payment' AND expires_at < $1 AND ($2::integer IS NULL OR id = $2)
     RETURNING id`,
    [now, orderId ?? null],
  );
  return rows.map((r) => r.id);
}
