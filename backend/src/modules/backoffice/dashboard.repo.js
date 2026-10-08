// @ts-check

/**
 * The back office dashboard's SQL: money and orders, counted in Nairobi days.
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {Record<string, any>} Row
 */

const DAY = "(created_at AT TIME ZONE 'Africa/Nairobi')::date";

/**
 * Money received per Nairobi day from `from` (YYYY-MM-DD) to `to`, inclusive; days with none are 0.
 * @param {Db} db
 * @param {string} from
 * @param {string} to
 * @returns {Promise<{ day: string; amount: number; payments: number }[]>}
 */
export async function revenueByDay(db, from, to) {
  const { rows } = await db.query(
    `SELECT d::date::text AS day, COALESCE(SUM(p.amount), 0)::integer AS amount, COUNT(p.id)::integer AS payments
     FROM generate_series($1::date, $2::date, interval '1 day') d
     LEFT JOIN payments p ON (p.created_at AT TIME ZONE 'Africa/Nairobi')::date = d::date
     GROUP BY d ORDER BY d`,
    [from, to],
  );
  return rows;
}

/**
 * Money received and orders placed between two Nairobi days (inclusive).
 * @param {Db} db
 * @param {string} from
 * @param {string} to
 * @returns {Promise<{ revenue: number; orders: number }>}
 */
export async function totals(db, from, to) {
  const [money, orders] = await Promise.all([
    db.query(`SELECT COALESCE(SUM(amount), 0)::integer AS n FROM payments WHERE ${DAY} BETWEEN $1 AND $2`, [from, to]),
    db.query(`SELECT COUNT(*)::integer AS n FROM orders WHERE ${DAY} BETWEEN $1 AND $2`, [from, to]),
  ]);
  return { revenue: money.rows[0].n, orders: orders.rows[0].n };
}

/**
 * Orders per status, and what is waiting for money.
 * @param {Db} db
 * @param {string} today
 * @returns {Promise<{ byStatus: Record<string, number>; awaiting: { orders: number; amount: number }; overdue: number; attention: number; unmatched: number }>}
 */
export async function pipeline(db, today) {
  const [statuses, awaiting, overdue, attention, unmatched] = await Promise.all([
    db.query('SELECT status, COUNT(*)::integer AS n FROM orders GROUP BY status'),
    db.query("SELECT COUNT(*)::integer AS orders, COALESCE(SUM(due_now), 0)::integer AS amount FROM orders WHERE status IN ('awaiting_payment', 'awaiting_balance') AND due_now > 0"),
    db.query(
      `SELECT COUNT(*)::integer AS n FROM orders
       WHERE COALESCE(promised_date, (estimate->>'readyBy')::date) < $1 AND status NOT IN ('completed', 'cancelled', 'expired')`,
      [today],
    ),
    db.query('SELECT COUNT(*)::integer AS n FROM orders WHERE attention IS NOT NULL'),
    db.query("SELECT COUNT(*)::integer AS n FROM c2b_confirmations WHERE status = 'unmatched'"),
  ]);
  return {
    byStatus: Object.fromEntries(statuses.rows.map((r) => [r.status, r.n])),
    awaiting: awaiting.rows[0],
    overdue: overdue.rows[0].n,
    attention: attention.rows[0].n,
    unmatched: unmatched.rows[0].n,
  };
}

/**
 * Orders and their totals per product category between two Nairobi days, biggest first.
 * @param {Db} db
 * @param {string} from
 * @param {string} to
 * @returns {Promise<{ category: string; orders: number; value: number }[]>}
 */
export async function byCategory(db, from, to) {
  const { rows } = await db.query(
    `SELECT COALESCE(c.name, o.product->>'category') AS category, COUNT(*)::integer AS orders, COALESCE(SUM(o.total), 0)::integer AS value
     FROM orders o LEFT JOIN categories c ON c.slug = o.product->>'category'
     WHERE (o.created_at AT TIME ZONE 'Africa/Nairobi')::date BETWEEN $1 AND $2 AND o.status NOT IN ('cancelled', 'expired')
     GROUP BY 1 ORDER BY value DESC, orders DESC LIMIT 8`,
    [from, to],
  );
  return rows;
}
