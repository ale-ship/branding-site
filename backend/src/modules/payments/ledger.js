// @ts-check
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { randomInt } from 'node:crypto';
import { nextNumber } from '../../lib/numbering.js';
import { insertEvent, insertNotifications } from '../orders/repo.js';
import { applyPayment } from './apply.js';
import * as repo from './repo.js';

/**
 * `record()`: THE one way money enters the system (docs/BACKEND_RUNBOOK.md, section 6). Called inside
 * the caller's transaction, by the STK callback, the STK status query, a matched Paybill payment and
 * a staff assignment of an unmatched one:
 *
 *   1. lock the order row;
 *   2. a receipt number seen before changes nothing (the unique column backs this up);
 *   3. the next receipt number (RCT);
 *   4. amounts and the status move (apply.js);
 *   5. the payment row, the prompt closed, the order updated;
 *   6. the events and the WhatsApp and email messages in the outbox.
 *
 * The caller queues the messages after commit. No network call happens in here.
 */

/** `PAY-` and eight digits. */
export const newPaymentId = () => `PAY-${randomInt(10_000_000, 100_000_000)}`;

/**
 * @typedef {object} Money
 * @property {number} orderId
 * @property {'stk' | 'paybill'} method
 * @property {string | null} phone
 * @property {number} amount Whole shillings.
 * @property {string} mpesaReceipt
 * @property {number | null} [requestId] The prompt it answers (STK).
 * @property {unknown} [raw] What the provider sent, kept with the payment.
 *
 * @typedef {{ recorded: false } | { recorded: true; receiptNo: string; notificationIds: number[] }} Recorded
 */

/**
 * @param {Pick<import('pg').PoolClient, 'query'>} trx A client inside a transaction.
 * @param {Money} m
 * @param {Date} [now]
 * @returns {Promise<Recorded>}
 */
export async function record(trx, m, now = new Date()) {
  const order = await repo.lockOrder(trx, m.orderId);
  if (!order) throw new Error(`ledger: no order ${m.orderId}`);
  if (await repo.receiptSeen(trx, m.mpesaReceipt)) return { recorded: false };

  const receiptNo = await nextNumber(trx, 'receipt');
  const applied = applyPayment(
    {
      ref: order.order_no,
      status: order.status,
      mechanism: order.mechanism,
      needsDesign: order.needs_design,
      total: order.total,
      amountPaid: order.amount_paid,
      credit: order.credit,
      dueNow: order.due_now,
      duePurpose: order.due_purpose,
      leadDays: order.estimate.leadDays,
    },
    m.amount,
    receiptNo,
    nairobiToday(now),
  );

  await repo.insertPayment(trx, {
    publicId: newPaymentId(),
    orderId: m.orderId,
    requestId: m.requestId ?? null,
    purpose: order.due_purpose ?? 'balance',
    method: m.method,
    phone: m.phone,
    amount: m.amount,
    mpesaReceipt: m.mpesaReceipt,
    receiptNo,
    raw: m.raw ?? null,
    at: now,
  });
  if (m.requestId) await repo.closeRequest(trx, m.requestId, 'confirmed', null, now);
  await repo.updateOrderMoney(trx, m.orderId, applied, now);
  for (const text of applied.events) await insertEvent(trx, m.orderId, text, now);

  /** @type {number[]} */
  let notificationIds = [];
  if (applied.message) {
    const payload = { text: applied.message, ref: order.order_no, receiptNo };
    notificationIds = await insertNotifications(
      trx,
      m.orderId,
      [
        { channel: 'whatsapp', recipient: order.customer_phone, template: 'payment-received', payload },
        { channel: 'email', recipient: order.customer_email, template: 'payment-received', payload },
      ],
      now,
    );
  }
  return { recorded: true, receiptNo, notificationIds };
}
