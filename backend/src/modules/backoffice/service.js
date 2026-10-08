// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { release } from '../capacity/repo.js';
import { queueNotifications } from '../notifications/service.js';
import { findByOrderNo, historyOf, insertEvent, insertNotifications } from '../orders/repo.js';
import { toOrder } from '../orders/view.js';
import { assignUnmatched, listUnmatched, markForRefund } from '../payments/c2b.service.js';
import { audit, auditOf } from '../staff/repo.js';
import * as repo from './repo.js';
import * as steps from './steps.js';

/**
 * The staff side of orders (docs/ORDER_WORKFLOW_SPEC.md, "Staff dashboard"): the order board, an
 * order with its audit trail, and the steps staff take. Each step runs in one transaction with the
 * order locked: the change, its event, the customer's message in the outbox and the audit row with
 * who did it. Messages are queued after commit.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../staff/repo.js').Staff} Staff
 */

/** The board's columns (spec: New, In design, Awaiting approval, In production, Ready, Out, Done). */
export const COLUMNS = {
  new: ['awaiting_payment'],
  design: ['in_design', 'on_hold'],
  approval: ['awaiting_approval', 'awaiting_balance'],
  production: ['in_production'],
  ready: ['ready'],
  out: ['out_for_handover'],
  done: ['completed', 'cancelled', 'expired'],
};
const OPEN = ['completed', 'cancelled', 'expired'];

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'The back office is unavailable for a moment.');
  return deps.pool;
}

/**
 * @param {Deps} deps
 * @param {{ column?: keyof typeof COLUMNS; q?: string; mechanism?: 'A' | 'B' | 'C' }} filters
 * @param {Date} [now]
 */
export async function board(deps, { column, q, mechanism }, now = new Date()) {
  const today = nairobiToday(now);
  const rows = await repo.board(need(deps), { statuses: column ? COLUMNS[column] : undefined, q: q?.trim() || undefined, mechanism });
  return rows.map((r) => {
    const due = r.promised_date ?? r.ready_by;
    return {
      ref: r.order_no,
      createdAt: new Date(r.created_at).toISOString(),
      status: r.status,
      mechanism: r.mechanism,
      product: r.product,
      quantity: r.quantity,
      urgency: r.urgency,
      handover: r.handover.method,
      customer: { name: r.customer_name, company: r.customer_company, phone: r.customer_phone },
      total: r.total,
      amountPaid: r.amount_paid,
      dueNow: r.due_now,
      credit: r.credit,
      progress: r.progress,
      dueBy: due,
      // Overdue: its date has passed and it isn't finished (red on the board).
      overdue: !!due && due < today && !OPEN.includes(r.status),
      attention: r.attention,
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    };
  });
}

/**
 * The order as the customer sees it, plus what only staff see.
 * @param {Deps} deps
 * @param {string} ref
 */
export async function orderForStaff(deps, ref) {
  const pool = need(deps);
  const row = await findByOrderNo(pool, ref.trim().toUpperCase());
  if (!row) throw new OrderError('not_found', 'There is no order with that number.');
  const [history, trail] = await Promise.all([historyOf(pool, row.id), auditOf(pool, row.id)]);
  return {
    order: toOrder(row, history),
    staff: {
      attention: row.attention,
      audit: trail.map((a) => ({ at: new Date(a.at).toISOString(), action: a.action, staff: a.staff, detail: a.detail })),
    },
  };
}

/**
 * Runs one step on a locked order and records it.
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {string} ref
 * @param {string} action For the audit log.
 * @param {(order: Record<string, any>) => steps.Step} decide
 * @param {Date} now
 * @param {(trx: import('pg').PoolClient, order: Record<string, any>) => Promise<void>} [extra] More writes in the same transaction.
 */
async function step(deps, staff, ref, action, decide, now, extra) {
  const ids = await withTransaction(need(deps), async (trx) => {
    const order = await findByOrderNo(trx, ref.trim().toUpperCase(), { lock: true });
    if (!order) throw new OrderError('not_found', 'There is no order with that number.');
    const s = decide(order);
    await repo.updateOrder(trx, order.id, s.fields, now);
    for (const text of s.events) await insertEvent(trx, order.id, text, now);
    if (extra) await extra(trx, order);
    await audit(trx, staff.id, action, order.id, s.audit);
    if (!s.message) return [];
    const payload = { text: s.message.text, ref: order.order_no };
    return insertNotifications(
      trx,
      order.id,
      [
        { channel: 'whatsapp', recipient: order.customer_phone, template: s.message.template, payload },
        { channel: 'email', recipient: order.customer_email, template: s.message.template, payload },
      ],
      now,
    );
  });
  await queueNotifications(deps, ids);
  return orderForStaff(deps, ref);
}

/**
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {string} ref
 * @param {number} pieces
 * @param {string} note
 * @param {Date} [now]
 */
export const logProgress = (deps, staff, ref, pieces, note, now = new Date()) =>
  step(deps, staff, ref, 'production-logged', (o) => steps.logPieces(o, pieces, note.trim()), now, (trx, o) =>
    repo.insertLog(trx, { orderId: o.id, pieces, note: note.trim(), staffId: staff.id, at: now }),
  );

/** @param {Deps} deps @param {Staff} staff @param {string} ref @param {Date} [now] */
export const markReady = (deps, staff, ref, now = new Date()) => step(deps, staff, ref, 'marked-ready', (o) => steps.markReady(o), now);

/**
 * @param {Deps} deps @param {Staff} staff @param {string} ref
 * @param {{ rider: string; riderPhone: string; waybill: string }} d
 * @param {Date} [now]
 */
export const dispatch = (deps, staff, ref, d, now = new Date()) => step(deps, staff, ref, 'dispatched', (o) => steps.dispatch(o, d, now), now);

/**
 * @param {Deps} deps @param {Staff} staff @param {string} ref
 * @param {{ code?: string; collector?: string; recipient?: string }} h
 * @param {Date} [now]
 */
export const handOver = (deps, staff, ref, h, now = new Date()) => step(deps, staff, ref, 'handed-over', (o) => steps.handOver(o, h, now), now);

/**
 * Cancels before production and lets go of the order's machine time.
 * @param {Deps} deps @param {Staff} staff @param {string} ref @param {string} reason @param {Date} [now]
 */
export const cancelOrder = (deps, staff, ref, reason, now = new Date()) =>
  step(deps, staff, ref, 'cancelled', (o) => steps.cancel(o, reason), now, (trx, o) => release(trx, [o.id]));

/**
 * Staff have dealt with what the order was flagged for (money after it closed, a refund).
 * @param {Deps} deps @param {Staff} staff @param {string} ref @param {Date} [now]
 */
export const clearAttention = (deps, staff, ref, now = new Date()) =>
  step(deps, staff, ref, 'attention-cleared', (o) => {
    if (!o.attention) throw new OrderError('invalid_state', 'Nothing is flagged on this order.');
    return { fields: { attention: null }, events: [], message: null, audit: { was: o.attention } };
  }, now);

// ── Unmatched Paybill payments ───────────────────────────────────────────────

/** @param {Deps} deps */
export async function unmatchedPayments(deps) {
  const rows = await listUnmatched(deps);
  return rows.map((r) => ({
    id: r.id,
    transId: r.trans_id,
    amount: Math.round(Number(r.body.TransAmount)),
    billRef: r.body.BillRefNumber ?? '',
    phone: r.body.MSISDN ?? '',
    payer: [r.body.FirstName, r.body.LastName].filter(Boolean).join(' '),
    reason: r.reason,
    receivedAt: new Date(r.received_at).toISOString(),
  }));
}

/** @param {Deps} deps @param {Staff} staff @param {number} id @param {string} ref */
export async function assignPayment(deps, staff, id, ref) {
  const result = await assignUnmatched(deps, id, ref, `staff:${staff.id}`);
  await audit(need(deps), staff.id, 'payment-assigned', null, { c2b: id, ref, result });
  return result;
}

/** @param {Deps} deps @param {Staff} staff @param {number} id */
export async function refundPayment(deps, staff, id) {
  await markForRefund(deps, id, `staff:${staff.id}`);
  await audit(need(deps), staff.id, 'payment-refund', null, { c2b: id });
}
