// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { randomInt } from 'node:crypto';
import { staffMessages } from '../notifications/templates.js';

/**
 * What each staff step does to an order (docs/ORDER_WORKFLOW_SPEC.md, "Order statuses and
 * tracking" and "Fulfilment"). Pure: the service locks the order, asks here, and writes the answer.
 * A step that isn't allowed in the order's status is refused with a message for staff.
 *
 *   in_production --log pieces--> (until every piece is done) --ready--> ready
 *   ready --(pickup) code + collector--> completed
 *   ready --(delivery) rider or waybill--> out_for_handover --recipient--> completed
 *   before production --cancel--> cancelled
 *
 * @typedef {Record<string, any>} Row
 * @typedef {{ template: string; text: string }} Message
 * @typedef {{ fields: Record<string, unknown>; events: string[]; message: Message | null; audit: Record<string, unknown> }} Step
 */

/** @param {string} what @param {string} status */
const refuse = (what, status) => new OrderError('invalid_state', `You can’t ${what} while the order is ${status.replace(/_/g, ' ')}.`);

/**
 * "+120": pieces printed (Mechanism A).
 * @param {Row} o
 * @param {number} pieces
 * @param {string} note
 * @returns {Step}
 */
export function logPieces(o, pieces, note) {
  if (o.status !== 'in_production') throw refuse('log production', o.status);
  if (o.progress?.kind !== 'pieces') throw new OrderError('invalid_state', 'This order is tracked by stages, not pieces.');
  const left = o.progress.total - o.progress.done;
  if (!Number.isInteger(pieces) || pieces < 1) throw new OrderError('invalid', 'Enter how many pieces were finished.');
  if (pieces > left) throw new OrderError('invalid', `Only ${left} ${left === 1 ? 'piece is' : 'pieces are'} left on this order.`);
  const done = o.progress.done + pieces;
  return {
    fields: { progress: { ...o.progress, done } },
    events: [`${pieces} printed${note ? ` (${note})` : ''}. ${done} of ${o.progress.total} done.`],
    message: null,
    audit: { pieces, note },
  };
}

/**
 * Checked and packed: ready for pickup (with a pickup code) or delivery.
 * @param {Row} o
 * @returns {Step}
 */
export function markReady(o) {
  if (o.status !== 'in_production') throw refuse('mark it ready', o.status);
  if (o.progress?.kind === 'pieces' && o.progress.done < o.progress.total) {
    throw new OrderError('invalid_state', `${o.progress.total - o.progress.done} pieces are still to print.`);
  }
  const method = o.handover?.method;
  if (method === 'pickup') {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    return {
      fields: { status: 'ready', pickup_code: code },
      events: ['Ready for pickup. Show your pickup code at the counter.'],
      message: { template: 'ready', text: staffMessages.readyForPickup(o.order_no, code) },
      audit: { method },
    };
  }
  if (method === 'delivery') {
    return { fields: { status: 'ready' }, events: ['Checked and packed; delivery is being arranged.'], message: { template: 'ready', text: staffMessages.readyForDelivery(o.order_no) }, audit: { method } };
  }
  throw new OrderError('invalid_state', 'Installations and digital handovers come with their own steps (B5).');
}

/**
 * Out with a rider or a courier.
 * @param {Row} o
 * @param {{ rider: string; riderPhone: string; waybill: string }} d
 * @param {Date} now
 * @returns {Step}
 */
export function dispatch(o, d, now) {
  if (o.status !== 'ready') throw refuse('send it out', o.status);
  if (o.handover?.method !== 'delivery') throw new OrderError('invalid_state', 'This order is collected, not delivered.');
  if (!d.waybill && !(d.rider && d.riderPhone)) throw new OrderError('invalid', 'Give the rider’s name and phone, or the courier’s waybill number.');
  return {
    fields: { status: 'out_for_handover', dispatch: { ...d, at: now.toISOString() } },
    events: [d.waybill ? `On its way by courier, waybill ${d.waybill}.` : `Out for delivery with ${d.rider}.`],
    message: { template: 'out-for-delivery', text: staffMessages.outForDelivery(o.order_no, d) },
    audit: d,
  };
}

/**
 * Handed over: collected at the counter with the right code, or delivered to a named recipient.
 * @param {Row} o
 * @param {{ code?: string; collector?: string; recipient?: string }} h
 * @param {Date} now
 * @returns {Step}
 */
export function handOver(o, h, now) {
  const method = o.handover?.method;
  let detail = '';
  /** @type {string | null} */
  let recipient = null;
  if (method === 'pickup') {
    if (o.status !== 'ready') throw refuse('hand it over', o.status);
    if (!h.code || h.code.trim() !== o.pickup_code) throw new OrderError('invalid', 'That pickup code doesn’t match this order.');
    if (!h.collector?.trim()) throw new OrderError('invalid', 'Enter the name of the person collecting.');
    detail = `Collected by ${h.collector.trim()} with the pickup code.`;
  } else if (method === 'delivery') {
    if (o.status !== 'out_for_handover') throw refuse('mark it delivered', o.status);
    if (!h.recipient?.trim()) throw new OrderError('invalid', 'Enter who received it.');
    recipient = h.recipient.trim();
    detail = `Delivered to ${recipient}.`;
  } else {
    throw new OrderError('invalid_state', 'Installations and digital handovers come with their own steps (B5).');
  }
  return {
    fields: { status: 'completed', handed_over: { at: now.toISOString(), method, detail, recipient } },
    events: [detail, 'Order complete. Thank you!'],
    message: { template: 'completed', text: staffMessages.completed(o.order_no) },
    audit: { method, detail },
  };
}

/** Cancelling is allowed any time before production (spec, "Order statuses"). */
const CANCELLABLE = ['awaiting_payment', 'in_design', 'awaiting_approval', 'awaiting_balance', 'on_hold'];

/**
 * @param {Row} o
 * @param {string} reason
 * @returns {Step}
 */
export function cancel(o, reason) {
  if (!CANCELLABLE.includes(o.status)) throw refuse('cancel it', o.status);
  if (!reason.trim()) throw new OrderError('invalid', 'Say why it is cancelled.');
  const refundDue = o.amount_paid > 0;
  return {
    fields: { status: 'cancelled', due_now: 0, due_purpose: null, expires_at: null, ...(refundDue ? { attention: 'refund-due' } : {}) },
    events: [`Cancelled: ${reason.trim()}.`],
    message: { template: 'cancelled', text: staffMessages.cancelled(o.order_no, refundDue) },
    audit: { reason: reason.trim(), refundDue },
  };
}
