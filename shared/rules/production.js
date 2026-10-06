// @ts-check
import { addWorkingDays, isWorkingDay, nairobiToday } from './calendar.js';

/**
 * @typedef {import('../contract/order-types.js').Delivery} Delivery
 * @typedef {import('../contract/order-types.js').ProductionLog} ProductionLog
 */

/**
 * Production and handover rules (docs/ORDER_WORKFLOW_SPEC.md, "Order statuses and tracking" and
 * "Fulfilment"). Pure: the order page uses them to explain, the backend to decide.
 */

/** Runs of this many pieces or more get a pre-production sample to approve first. TODO(business): confirm. */
export const SAMPLE_THRESHOLD = 200;

/**
 * @param {string} mechanism
 * @param {number} quantity
 */
export const needsSample = (mechanism, quantity) => mechanism === 'A' && quantity >= SAMPLE_THRESHOLD;

/**
 * The pieces-a-day rate behind the ETA: the recent rate from the logs once they span two working days
 * or more (the spec's "recent rate from the production logs"), else the machine's daily capacity
 * (`MACHINES` in capacity.js).
 * @param {ProductionLog[]} logs
 * @param {number | null} capacity
 * @returns {number | null}
 */
export function productionRate(logs, capacity) {
  /** @type {Map<string, number>} */
  const byDay = new Map();
  for (const l of logs) {
    const day = nairobiToday(new Date(l.at));
    byDay.set(day, (byDay.get(day) ?? 0) + l.pieces);
  }
  const days = [...byDay.keys()].filter(isWorkingDay);
  if (days.length >= 2) {
    const total = days.reduce((s, d) => s + (byDay.get(d) ?? 0), 0);
    return Math.max(1, Math.round(total / days.length));
  }
  return capacity && capacity > 0 ? capacity : null;
}

/**
 * @typedef {object} Eta
 * @property {number} left
 * @property {number | null} perDay
 * @property {string | null} finishBy YYYY-MM-DD; null when there's no rate to go on.
 * @property {boolean} atRisk True when the finish date falls after the promised one.
 */

/**
 * When a quantity run should finish: the pieces still to print divided by the rate, counted in working
 * days from `today` (today counts when it's a working day and there's room left in it).
 * @param {number} done
 * @param {number} total
 * @param {ProductionLog[]} logs
 * @param {number | null} capacity
 * @param {string} today
 * @param {string | null} promisedBy
 * @returns {Eta}
 */
export function productionEta(done, total, logs, capacity, today, promisedBy) {
  const left = Math.max(0, total - done);
  const perDay = productionRate(logs, capacity);
  if (left === 0) return { left, perDay, finishBy: today, atRisk: false };
  if (!perDay) return { left, perDay, finishBy: null, atRisk: false };
  const days = Math.ceil(left / perDay);
  const finishBy = isWorkingDay(today) ? addWorkingDays(today, days - 1) : addWorkingDays(today, days);
  return { left, perDay, finishBy, atRisk: promisedBy !== null && finishBy > promisedBy };
}

/**
 * Pieces finished but not yet sent or asked for: what an early (partial) delivery can take.
 * @param {number} done
 * @param {Delivery[]} deliveries
 */
export function deliverablePieces(done, deliveries) {
  return Math.max(0, done - deliveries.reduce((s, d) => s + d.pieces, 0));
}

/**
 * Why an early delivery of `pieces` can't be asked for, or null.
 * @param {number} pieces
 * @param {number} done
 * @param {number} total
 * @param {Delivery[]} deliveries
 * @returns {string | null}
 */
export function partialDeliveryError(pieces, done, total, deliveries) {
  const open = deliveries.some((d) => d.status !== 'delivered');
  if (open) return 'One early delivery is already on its way; ask for the next when it has arrived.';
  const max = deliverablePieces(done, deliveries);
  if (!Number.isInteger(pieces) || pieces < 1) return 'Enter how many finished pieces you want early.';
  if (max === 0) return 'No finished pieces are waiting yet.';
  if (pieces > max) return `Only ${max.toLocaleString('en-KE')} finished pieces are waiting.`;
  if (done >= total) return 'The whole order is finished: it comes in one delivery.';
  return null;
}

/**
 * Six digits for pickup at the counter.
 * @param {string} code
 */
export const isPickupCode = (code) => /^\d{6}$/.test(code.trim());
