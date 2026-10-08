// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { orderRefFromBillRef, routeC2B } from '@noorcom-branding/shared/rules/c2b.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { queueNotifications } from '../notifications/service.js';
import * as c2b from './c2b.repo.js';
import { record } from './ledger.js';
import { fromAbsaC2B } from './providers/absa/c2b.js';
import { storeCallback } from './repo.js';

/**
 * Paybill payments through Absa C2B on 303030 (docs/BACKEND_RUNBOOK.md, section 6):
 *
 *   1. `receiveC2B`: the confirmation is stored as received (a repeated transaction id is
 *      acknowledged and dropped) and queued; Absa gets its answer at once.
 *   2. `processC2B` (the worker): routed with shared/rules/c2b.js (the order number in the account
 *      reference; else the payer's phone and the exact amount due), then recorded through the ledger,
 *      or kept as unmatched with the reason.
 *   3. Staff assign an unmatched payment to an order or mark it for a refund (`assignUnmatched`,
 *      `markForRefund`); their screen and routes come with the back office (B4).
 *
 * @typedef {import('../../deps.js').Deps} Deps
 */

/**
 * @param {Deps} deps
 * @param {unknown} body
 * @returns {Promise<{ stored: boolean }>}
 */
export async function receiveC2B(deps, body) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'Unavailable.');
  const confirmation = fromAbsaC2B(body);
  if (!confirmation) {
    // Kept for staff to read; nothing to route.
    await storeCallback(deps.pool, 'absa-c2b-unreadable', body);
    deps.logger?.warn('c2b confirmation we could not read; stored');
    return { stored: false };
  }
  const id = await c2b.insertConfirmation(deps.pool, confirmation.receipt, body);
  if (id === null) return { stored: false };
  if (deps.jobs) await deps.jobs.enqueue('process-c2b', { id }, { jobId: `process-c2b-${id}` });
  else deps.logger?.warn({ id }, 'c2b confirmation stored but not queued (no Redis)');
  return { stored: true };
}

/**
 * @param {Deps} deps
 * @param {number} id
 * @param {Date} [now]
 * @returns {Promise<string>} What happened.
 */
export async function processC2B(deps, id, now = new Date()) {
  const pool = /** @type {import('pg').Pool} */ (deps.pool);
  const row = await c2b.findConfirmation(pool, id);
  if (!row || row.status !== 'pending') return 'done-before';
  const confirmation = fromAbsaC2B(row.body);
  if (!confirmation) {
    await c2b.settleConfirmation(pool, id, { status: 'unmatched', reason: 'unreadable' });
    return 'unmatched unreadable';
  }
  const found = await c2b.candidates(pool, orderRefFromBillRef(confirmation.billRef), confirmation.msisdn);
  const route = routeC2B(confirmation, found, deps.config?.absa.paybill);
  if (route.kind === 'unmatched') {
    await c2b.settleConfirmation(pool, id, { status: 'unmatched', reason: route.reason });
    deps.logger?.info({ id, reason: route.reason }, 'paybill payment unmatched');
    return `unmatched ${route.reason}`;
  }
  const orderId = /** @type {number} */ (found.find((o) => o.ref === route.ref)?.id);
  const done = await recordConfirmation(deps, id, orderId, confirmation, { status: 'recorded', routedBy: route.by }, now);
  return done;
}

/**
 * Staff put an unmatched payment on an order.
 * @param {Deps} deps
 * @param {number} id
 * @param {string} orderNo
 * @param {string} staff Who did it, for the record.
 * @param {Date} [now]
 */
export async function assignUnmatched(deps, id, orderNo, staff, now = new Date()) {
  const pool = /** @type {import('pg').Pool} */ (deps.pool);
  const row = await c2b.findConfirmation(pool, id);
  if (!row || row.status !== 'unmatched') throw new OrderError('invalid_state', 'That payment is not waiting to be matched.');
  const orderId = await c2b.orderIdOf(pool, orderNo.trim().toUpperCase());
  if (!orderId) throw new OrderError('not_found', 'There is no order with that number.');
  const confirmation = fromAbsaC2B(row.body);
  if (!confirmation) throw new OrderError('invalid_state', 'That payment can’t be read; refund it instead.');
  return recordConfirmation(deps, id, orderId, confirmation, { status: 'assigned', routedBy: 'staff', assignedBy: staff }, now, 'unmatched');
}

/**
 * Staff mark an unmatched payment to be refunded.
 * @param {Deps} deps
 * @param {number} id
 * @param {string} staff
 */
export async function markForRefund(deps, id, staff) {
  const pool = /** @type {import('pg').Pool} */ (deps.pool);
  const row = await c2b.findConfirmation(pool, id);
  if (!row || row.status !== 'unmatched') throw new OrderError('invalid_state', 'That payment is not waiting to be matched.');
  await c2b.settleConfirmation(pool, id, { status: 'refund', reason: row.reason, assignedBy: staff });
}

/**
 * @param {Deps} deps
 */
export async function listUnmatched(deps) {
  return c2b.listUnmatched(/** @type {import('pg').Pool} */ (deps.pool));
}

/**
 * The confirmation's money through the ledger, and the confirmation settled, in one transaction.
 * @param {Deps} deps
 * @param {number} id
 * @param {number} orderId
 * @param {import('@noorcom-branding/shared/rules/c2b.js').C2BConfirmation} c
 * @param {{ status: string; routedBy: string; assignedBy?: string }} outcome
 * @param {Date} now
 * @param {string} [expected] The status the confirmation must still have.
 */
async function recordConfirmation(deps, id, orderId, c, outcome, now, expected = 'pending') {
  const pool = /** @type {import('pg').Pool} */ (deps.pool);
  const done = await withTransaction(pool, async (trx) => {
    const locked = await c2b.findConfirmation(trx, id, { lock: true });
    if (!locked || locked.status !== expected) return null;
    const result = await record(trx, { orderId, method: 'paybill', phone: c.msisdn, amount: c.amount, mpesaReceipt: c.receipt, raw: c }, now);
    await c2b.settleConfirmation(trx, id, { ...outcome, orderId, reason: result.recorded ? null : 'receipt-seen-before' });
    return result;
  });
  if (!done) return 'done-before';
  if (done.recorded) await queueNotifications(deps, done.notificationIds);
  return done.recorded ? `${outcome.status} ${done.receiptNo}` : 'receipt-seen-before';
}
