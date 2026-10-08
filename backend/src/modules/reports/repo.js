// @ts-check

/**
 * The reports' and customer accounts' SQL: invoices, payments, balances and Paybill money nobody
 * could match, counted in Nairobi days. Money is whole shillings.
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

const nairobiDay = (/** @type {string} */ col) => `(${col} AT TIME ZONE 'Africa/Nairobi')::date`;

/**
 * What an order has invoiced, as shared/rules/statement.js `invoicedAmount`: expired and cancelled
 * orders count only for money paid on them; a site job without a firm price, its survey fee.
 */
export const INVOICED = `CASE WHEN o.status IN ('expired', 'cancelled') THEN o.amount_paid
  ELSE COALESCE(o.total, (o.estimate->'dueNow'->>'amount')::integer) END`;

/** Orders that owe or may owe money: placed and paid for, not closed. */
const OPEN = "o.status NOT IN ('awaiting_payment', 'expired', 'cancelled')";

/**
 * Invoices issued between two Nairobi days on orders that went ahead (their first payment came in),
 * oldest first.
 * @param {Db} db
 * @param {string} from
 * @param {string} to
 * @returns {Promise<Row[]>}
 */
export async function invoices(db, from, to) {
  const { rows } = await db.query(
    `SELECT i.invoice_no, ${nairobiDay('i.created_at')}::text AS day, o.order_no, o.customer_name, o.customer_company,
            o.product->>'name' AS product, o.quantity, o.status, (${INVOICED})::integer AS invoiced, o.amount_paid
     FROM invoices i JOIN orders o ON o.id = i.order_id
     WHERE ${nairobiDay('i.created_at')} BETWEEN $1 AND $2 AND o.status <> 'awaiting_payment'
     ORDER BY i.created_at, i.id`,
    [from, to],
  );
  return rows;
}

/**
 * Payments received between two Nairobi days, oldest first.
 * @param {Db} db
 * @param {string} from
 * @param {string} to
 * @returns {Promise<Row[]>}
 */
export async function payments(db, from, to) {
  const { rows } = await db.query(
    `SELECT p.receipt_no, ${nairobiDay('p.created_at')}::text AS day, p.created_at, o.order_no, o.customer_name,
            p.method, p.mpesa_receipt, p.purpose, p.amount
     FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE ${nairobiDay('p.created_at')} BETWEEN $1 AND $2
     ORDER BY p.created_at, p.id`,
    [from, to],
  );
  return rows;
}

/**
 * Open orders with money still owed, as at `day`, oldest invoice first.
 * @param {Db} db
 * @param {string} day
 * @returns {Promise<Row[]>}
 */
export async function receivables(db, day) {
  const { rows } = await db.query(
    `SELECT o.order_no, i.invoice_no, o.customer_name, o.customer_phone, o.status,
            ${nairobiDay('o.created_at')}::text AS placed, ($1::date - ${nairobiDay('o.created_at')})::integer AS age,
            (${INVOICED})::integer AS invoiced, o.amount_paid, ((${INVOICED}) - o.amount_paid)::integer AS balance
     FROM orders o JOIN invoices i ON i.order_id = o.id
     WHERE ${OPEN} AND (${INVOICED}) > o.amount_paid AND ${nairobiDay('o.created_at')} <= $1
     ORDER BY o.created_at, o.id`,
    [day],
  );
  return rows;
}

/**
 * Orders, pieces and value per product for orders placed between two Nairobi days, biggest first.
 * Orders still waiting for their first payment, expired and cancelled ones are left out.
 * @param {Db} db
 * @param {string} from
 * @param {string} to
 * @returns {Promise<Row[]>}
 */
export async function byProduct(db, from, to) {
  const { rows } = await db.query(
    `SELECT o.product->>'name' AS product, COALESCE(c.name, o.product->>'category') AS category,
            COUNT(*)::integer AS orders, SUM(o.quantity)::integer AS pieces,
            SUM(${INVOICED})::integer AS invoiced, SUM(o.amount_paid)::integer AS paid
     FROM orders o LEFT JOIN categories c ON c.slug = o.product->>'category'
     WHERE ${nairobiDay('o.created_at')} BETWEEN $1 AND $2 AND o.status NOT IN ('awaiting_payment', 'expired', 'cancelled')
     GROUP BY 1, 2 ORDER BY invoiced DESC, orders DESC, product`,
    [from, to],
  );
  return rows;
}

/**
 * Paybill money that did not match an order by itself, received between two Nairobi days: still
 * waiting, assigned by staff, or to be refunded.
 * @param {Db} db
 * @param {string} from
 * @param {string} to
 * @returns {Promise<Row[]>}
 */
export async function suspense(db, from, to) {
  const { rows } = await db.query(
    `SELECT c.trans_id, ${nairobiDay('c.received_at')}::text AS day, c.body, c.status, c.reason, c.assigned_by, o.order_no
     FROM c2b_confirmations c LEFT JOIN orders o ON o.id = c.order_id
     WHERE c.status IN ('unmatched', 'assigned', 'refund') AND ${nairobiDay('c.received_at')} BETWEEN $1 AND $2
     ORDER BY c.received_at, c.id`,
    [from, to],
  );
  return rows;
}

/**
 * Customers (an account is its email) with what they were invoiced and paid, the biggest balance
 * first; `q` finds a name, company, email or phone.
 * @param {Db} db
 * @param {string} q
 * @returns {Promise<Row[]>}
 */
export async function accounts(db, q) {
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const { rows } = await db.query(
    `SELECT o.customer_email AS email,
            (ARRAY_AGG(o.customer_name ORDER BY o.created_at DESC))[1] AS name,
            (ARRAY_AGG(o.customer_company ORDER BY o.created_at DESC))[1] AS company,
            (ARRAY_AGG(o.customer_phone ORDER BY o.created_at DESC))[1] AS phone,
            COUNT(*) FILTER (WHERE o.status NOT IN ('expired', 'cancelled'))::integer AS orders,
            SUM(${INVOICED})::integer AS invoiced, SUM(o.amount_paid)::integer AS paid,
            SUM((${INVOICED}) - o.amount_paid)::integer AS balance,
            MAX(o.created_at) AS last_order
     FROM orders o
     GROUP BY o.customer_email
     HAVING $1 = '%%' OR BOOL_OR(o.customer_email ILIKE $1 OR o.customer_name ILIKE $1 OR o.customer_company ILIKE $1 OR o.customer_phone ILIKE $1)
     ORDER BY balance DESC, last_order DESC
     LIMIT 200`,
    [like],
  );
  return rows;
}

/**
 * One customer's orders with their invoice numbers, and every payment on them: what a statement of
 * account is built from.
 * @param {Db} db
 * @param {string} email
 * @returns {Promise<{ orders: Row[]; payments: Row[] }>}
 */
export async function statementOf(db, email) {
  const orders = await db.query(
    `SELECT o.id, o.order_no, i.invoice_no, o.status, o.total, o.estimate, o.amount_paid, o.product, o.created_at,
            o.customer_name, o.customer_company, o.customer_phone
     FROM orders o JOIN invoices i ON i.order_id = o.id
     WHERE o.customer_email = $1 ORDER BY o.created_at, o.id`,
    [email],
  );
  const ids = orders.rows.map((r) => r.id);
  const payments = ids.length
    ? await db.query('SELECT order_id, method, mpesa_receipt, receipt_no, amount, created_at FROM payments WHERE order_id = ANY($1) ORDER BY created_at, id', [ids])
    : { rows: [] };
  return { orders: orders.rows, payments: payments.rows };
}
