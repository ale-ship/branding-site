// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { normaliseKenyanPhone } from '@noorcom-branding/shared/rules/phone.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { key } from '../../redis.js';
import { queueNotifications } from '../notifications/service.js';
import { findOrderFor } from '../orders/service.js';
import { newPaymentId, record } from './ledger.js';
import { parseStkCallback, STK_MESSAGES } from './providers/absa/stk.js';
import * as repo from './repo.js';
import { toPayment } from './view.js';

/**
 * M-Pesa STK Push (docs/BACKEND_RUNBOOK.md, section 6, "STK Push"):
 *
 *   1. `startStk`: something must be due and no prompt pending (a Redis lock and a unique index);
 *      the prompt is stored, then Absa is called outside any transaction, and a status query is
 *      queued for when the prompt times out.
 *   2. Absa calls back: `receiveStkCallback` stores the body and answers at once; the worker runs
 *      `settleStkCallback`, which records the money through the ledger or closes the prompt.
 *   3. No callback in time: the worker's `queryStk` asks Absa, then times the prompt out.
 *
 * The order moves only on a confirmed payment, never because the browser says so.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderPayment} OrderPayment
 * @typedef {import('./providers/absa/stk.js').StkResult} StkResult
 */

const PROMPT_SECONDS = 60;
const LOCK_SECONDS = 75;
const lockKey = (/** @type {string} */ ref) => key('stk', 'lock', ref);

/** @param {Deps} deps */
function needAll(deps) {
  const { pool, redis, jobs, absa } = deps;
  // A prompt needs its lock and its follow-up job: without Redis, try again shortly (section 2.2).
  if (!pool || !redis || !jobs || !absa) throw new AppError(503, 'try_again', 'Paying online is unavailable for a moment. Please try again, or pay by Paybill.');
  return { pool, redis, jobs, absa };
}

/**
 * Sends the M-Pesa prompt for what is due now. A second tap returns the prompt already on its way.
 * @param {Deps} deps
 * @param {string} ref
 * @param {{ token: string } | { phone: string }} access
 * @param {string} phone The number to pay from, as typed.
 * @param {Date} [now]
 * @returns {Promise<OrderPayment>}
 */
export async function startStk(deps, ref, access, phone, now = new Date()) {
  const { pool, redis, jobs, absa } = needAll(deps);
  const order = await findOrderFor(deps, ref, access, now);
  if (!['awaiting_payment', 'awaiting_balance'].includes(order.status) || order.due_now <= 0) {
    throw new OrderError('invalid_state', 'Nothing is due on this order right now.');
  }
  const msisdn = normaliseKenyanPhone(phone);
  if (!msisdn) throw new OrderError('invalid', 'Enter the Safaricom number to pay from, like 0722 530 301.');

  const pending = await repo.pendingRequest(pool, order.id);
  if (pending) return toPayment(pending, null);
  if ((await redis.set(lockKey(order.order_no), '1', 'EX', LOCK_SECONDS, 'NX')) !== 'OK') {
    const again = await repo.pendingRequest(pool, order.id);
    if (again) return toPayment(again, null);
    throw new OrderError('invalid_state', 'A payment request is already on its way to your phone.');
  }

  const request = await repo.insertRequest(pool, {
    publicId: newPaymentId(),
    orderId: order.id,
    provider: 'absa',
    purpose: order.due_purpose ?? 'balance',
    phone: msisdn,
    amount: order.due_now,
    timeoutAt: new Date(now.getTime() + PROMPT_SECONDS * 1000),
    at: now,
  });
  if (!request) {
    await redis.del(lockKey(order.order_no));
    const again = await repo.pendingRequest(pool, order.id);
    if (again) return toPayment(again, null);
    throw new AppError(503, 'try_again', 'Please try again.');
  }

  try {
    const { requestId } = await absa.stkPush({ phone: msisdn, amount: order.due_now, accountRef: order.order_no, description: `Order ${order.order_no}` });
    await repo.setProviderRequestId(pool, request.id, requestId);
  } catch (err) {
    deps.logger?.warn({ err, ref: order.order_no }, 'stk push failed');
    await repo.closeRequest(pool, request.id, 'failed', 'We couldn’t reach M-Pesa. Please try again, or pay by Paybill.', now);
    await redis.del(lockKey(order.order_no));
    return toPayment((await repo.findRequest(pool, { id: request.id })) ?? request, null);
  }
  // Ask Absa if nothing has come back by the prompt's timeout (a little after, to let a late callback land).
  await jobs.enqueue('stk-query', { requestId: request.id }, { delayMs: (PROMPT_SECONDS + 5) * 1000, jobId: `stk-query-${request.id}` });
  return toPayment(request, null);
}

/**
 * Absa's callback: store it as received and queue it. Always answers, even for a body we can't read
 * (it is kept for staff); Absa must never be made to retry because of us.
 * @param {Deps} deps
 * @param {unknown} body
 */
export async function receiveStkCallback(deps, body) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'Unavailable.');
  const id = await repo.storeCallback(deps.pool, 'absa-stk', body);
  if (deps.jobs) await deps.jobs.enqueue('settle-stk', { callbackId: id }, { jobId: `settle-stk-${id}` });
  else deps.logger?.warn({ callbackId: id }, 'stk callback stored but not queued (no Redis)');
  return id;
}

/**
 * The worker's side of a stored callback.
 * @param {Deps} deps
 * @param {number} callbackId
 * @returns {Promise<string>} What happened, also kept on the callback row.
 */
export async function settleStkCallback(deps, callbackId) {
  const pool = /** @type {import('pg').Pool} */ (deps.pool);
  const cb = await repo.findCallback(pool, callbackId);
  if (!cb || cb.processed_at) return 'done-before';
  const result = parseStkCallback(cb.body);
  const outcome = result ? await applyStkResult(deps, result) : 'unreadable';
  await repo.markCallback(pool, callbackId, outcome);
  return outcome;
}

/**
 * The worker's status query for a prompt nothing has answered.
 * @param {Deps} deps
 * @param {number} requestId
 * @param {Date} [now]
 * @returns {Promise<string>}
 */
export async function queryStk(deps, requestId, now = new Date()) {
  const pool = /** @type {import('pg').Pool} */ (deps.pool);
  const absa = /** @type {import('../../integrations/absa/index.js').AbsaClient} */ (deps.absa);
  const request = await repo.findRequest(pool, { id: requestId });
  if (!request || request.status !== 'pending') return 'settled-before';
  /** @type {import('../../integrations/absa/index.js').StkStatus} */
  const status = request.provider_request_id ? await absa.stkQuery(request.provider_request_id) : { state: 'pending' };
  if (status.state !== 'pending') return applyStkResult(deps, { requestId: request.provider_request_id, ...status }, now);
  if (now < request.timeout_at) return 'still-waiting';
  return applyStkResult(deps, { requestId: request.provider_request_id ?? '', state: 'timeout', message: STK_MESSAGES.timeout }, now, request);
}

/**
 * A prompt's outcome, however it arrived: money through the ledger, or the prompt closed.
 * @param {Deps} deps
 * @param {StkResult} result
 * @param {Date} [now]
 * @param {Record<string, any>} [known] The prompt, when the caller already has it.
 * @returns {Promise<string>}
 */
async function applyStkResult(deps, result, now = new Date(), known) {
  const pool = /** @type {import('pg').Pool} */ (deps.pool);
  const request = known ?? (await repo.findRequest(pool, { providerRequestId: result.requestId }));
  if (!request) return 'unknown-request';
  /** @type {string} */
  let outcome;
  if (result.state === 'paid') {
    const done = await withTransaction(pool, (trx) =>
      record(trx, { orderId: request.order_id, method: 'stk', phone: result.phone ?? request.phone, amount: result.amount, mpesaReceipt: result.receipt, requestId: request.id, raw: result }, now),
    );
    if (done.recorded) await queueNotifications(deps, done.notificationIds);
    outcome = done.recorded ? `paid ${done.receiptNo}` : 'receipt-seen-before';
  } else {
    const closed = await repo.closeRequest(pool, request.id, result.state, result.message, now);
    outcome = closed ? result.state : 'settled-before';
  }
  await deps.redis?.del(lockKey(await repo.orderNoOf(pool, request.order_id))).catch(() => {});
  return outcome;
}
