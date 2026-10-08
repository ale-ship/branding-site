// @ts-check

/**
 * The capacity calendar's SQL (docs/BACKEND_RUNBOOK.md, step B2): machine time held by orders, in
 * `capacity_bookings`.
 *
 * @typedef {import('@noorcom-branding/shared/rules/capacity.js').CapacityCalendar} CapacityCalendar
 * @typedef {import('@noorcom-branding/shared/rules/capacity.js').Machine} Machine
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 */

/**
 * Units booked per machine per day, from `from` (YYYY-MM-DD) on.
 * @param {Db} db
 * @param {string} from
 * @returns {Promise<CapacityCalendar>}
 */
export async function bookedFrom(db, from) {
  const { rows } = await db.query(
    `SELECT machine, day, SUM(units)::integer AS units FROM capacity_bookings WHERE day >= $1 GROUP BY machine, day`,
    [from],
  );
  /** @type {Record<string, Record<string, number>>} */
  const calendar = {};
  for (const r of rows) (calendar[r.machine] ??= {})[r.day] = r.units;
  return calendar;
}

/**
 * Holds machine time for an order.
 * @param {Db} trx
 * @param {number} orderId
 * @param {Machine} machine
 * @param {Record<string, number>} days
 */
export async function book(trx, orderId, machine, days) {
  const entries = Object.entries(days).filter(([, units]) => units > 0);
  if (!entries.length) return;
  await trx.query(
    `INSERT INTO capacity_bookings (order_id, machine, day, units)
     SELECT $1, $2, d.day, d.units FROM unnest($3::date[], $4::integer[]) AS d (day, units)`,
    [orderId, machine, entries.map(([day]) => day), entries.map(([, units]) => units)],
  );
}

/**
 * Lets go of everything the orders held (they expired unpaid).
 * @param {Db} trx
 * @param {number[]} orderIds
 */
export async function release(trx, orderIds) {
  if (orderIds.length) await trx.query('DELETE FROM capacity_bookings WHERE order_id = ANY($1::integer[])', [orderIds]);
}

/**
 * Orders take turns to book: the calendar read and the booking happen under one lock, so two orders
 * at once can't both take the last slot. Held until the transaction ends.
 * @param {Db} trx
 */
export async function lockCalendar(trx) {
  await trx.query("SELECT pg_advisory_xact_lock(hashtext('nb:capacity'))");
}
