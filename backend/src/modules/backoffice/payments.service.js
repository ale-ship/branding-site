// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { CHANNEL_LABEL, paymentReference } from '@noorcom-branding/shared/rules/manual-payment.js';
import { randomInt } from 'node:crypto';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { queueNotifications } from '../notifications/service.js';
import { findByOrderNo } from '../orders/repo.js';
import { record } from '../payments/ledger.js';
import { orderOfReceipt } from '../payments/repo.js';
import { audit } from '../staff/repo.js';
import { updateOrder } from './repo.js';
import { orderForStaff } from './service.js';

/**
 * Payments recorded by hand (owner, 21 Oct 2026). Until the M-Pesa prompt is connected, customers pay
 * to the Paybill on their invoice (or by bank or cash) and a designer, signed in with their own
 * account, records the payment on the order. It goes through the ledger like any confirmed payment
 * (receipt number, status, the customer's messages), clears the customer's "I've paid" report, and
 * is audited with who recorded it.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../staff/repo.js').Staff} Staff
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').PaymentChannel} PaymentChannel
 */

/** How far back a payment can be dated: older money is a conversation, not a form. */
const MAX_DAYS_BACK = 60;

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'Orders are unavailable for a moment. Please try again shortly.');
  return deps.pool;
}

/**
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {string} ref
 * @param {{ amount: number; channel: PaymentChannel; reference: string; paidOn: string }} p
 * @param {Date} [now]
 */
export async function recordPayment(deps, staff, ref, p, now = new Date()) {
  const pool = need(deps);
  const reference = paymentReference(p.channel, p.reference);
  if (reference === null) {
    throw new OrderError('invalid', p.channel === 'mpesa' ? 'An M-Pesa code is ten letters and digits, like TJK4XY12AB.' : 'Enter the bank’s reference for the transfer.');
  }
  const today = nairobiToday(now);
  if (p.paidOn > today) throw new OrderError('invalid', 'The payment date can’t be in the future.');
  const earliest = new Date(Date.parse(`${today}T00:00:00Z`) - MAX_DAYS_BACK * 86_400_000).toISOString().slice(0, 10);
  if (p.paidOn < earliest) throw new OrderError('invalid', 'That date is too far back; check it with the admin.');
  // Cash has no reference of its own; bank references get a prefix so they can't clash with M-Pesa codes.
  const key = p.channel === 'cash' ? `CASH-${randomInt(10_000_000, 100_000_000)}` : p.channel === 'bank' ? `BANK-${reference}` : reference;

  const ids = await withTransaction(pool, async (trx) => {
    const order = await findByOrderNo(trx, ref.trim().toUpperCase(), { lock: true });
    if (!order) throw new OrderError('not_found', 'There is no order with that number.');
    const earlier = await orderOfReceipt(trx, key);
    if (earlier) throw new OrderError('invalid_state', `That ${CHANNEL_LABEL[p.channel]} reference is already recorded, on ${earlier}.`);
    // The customer's report is answered by this payment (cleared first: the ledger may flag the order itself).
    if (order.payment_report || order.attention === 'payment-reported') {
      await updateOrder(trx, order.id, { payment_report: null, ...(order.attention === 'payment-reported' ? { attention: null } : {}) }, now);
    }
    const done = await record(
      trx,
      {
        orderId: order.id,
        method: 'manual',
        phone: null,
        amount: p.amount,
        mpesaReceipt: key,
        channel: p.channel,
        recordedBy: staff.id,
        raw: { channel: p.channel, reference, paidOn: p.paidOn, recordedBy: staff.name },
      },
      now,
    );
    if (!done.recorded) throw new OrderError('invalid_state', 'That payment is already recorded.');
    await audit(trx, staff.id, 'payment-recorded', order.id, { amount: p.amount, channel: p.channel, reference, paidOn: p.paidOn, receiptNo: done.receiptNo });
    return done.notificationIds;
  });
  await queueNotifications(deps, ids);
  return orderForStaff(deps, ref);
}
