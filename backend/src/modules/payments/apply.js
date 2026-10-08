// @ts-check
import { addWorkingDays } from '@noorcom-branding/shared/rules/calendar.js';

/**
 * What a confirmed payment does to an order (docs/BACKEND_RUNBOOK.md, section 6, step 4 and 5).
 * Pure: the ledger reads the order under lock, asks this, and writes the answer. The same rules as
 * the site's mock (src/lib/api/mock-orders.ts, `applyCallback` and `advanceAfterPayment`):
 *
 * - underpaid: the rest is still due and the status doesn't move;
 * - overpaid: with a known total, only money beyond the whole total becomes credit; without one
 *   (site jobs before their firm quote), anything beyond what was due is credit;
 * - the step fully paid: the order moves on (deposit → in design; balance → in production, or
 *   completed for a site job) and stops expiring;
 * - the order already closed (expired, cancelled): all of it is kept as credit and staff are told.
 *
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderStatus} OrderStatus
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').PaymentPurpose} PaymentPurpose
 *
 * @typedef {object} OrderMoney
 * @property {string} ref
 * @property {OrderStatus} status
 * @property {'A' | 'B' | 'C'} mechanism
 * @property {boolean} needsDesign
 * @property {number | null} total
 * @property {number} amountPaid
 * @property {number} credit
 * @property {number} dueNow
 * @property {PaymentPurpose | null} duePurpose
 * @property {number} leadDays
 *
 * @typedef {object} Applied
 * @property {OrderStatus} status
 * @property {number} amountPaid
 * @property {number} credit
 * @property {number} dueNow
 * @property {PaymentPurpose | null} duePurpose
 * @property {boolean} stopExpiry
 * @property {{ startedOn: string; promisedDate: string } | null} production
 * @property {string | null} attention
 * @property {string[]} events
 * @property {string | null} message What to tell the customer (WhatsApp and email).
 */

const CLOSED = ['expired', 'cancelled'];

/** @param {number} n */
const kes = (n) => `KES ${n.toLocaleString('en-KE')}`;

/**
 * @param {OrderMoney} o
 * @param {number} amount Whole shillings, as M-Pesa confirmed.
 * @param {string} receiptNo Noorcom's receipt number for this payment.
 * @param {string} today YYYY-MM-DD in Nairobi.
 * @returns {Applied}
 */
export function applyPayment(o, amount, receiptNo, today) {
  /** @type {Applied} */
  const r = {
    status: o.status,
    amountPaid: o.amountPaid + amount,
    credit: o.credit,
    dueNow: o.dueNow,
    duePurpose: o.duePurpose,
    stopExpiry: false,
    production: null,
    attention: null,
    events: [],
    message: null,
  };

  if (CLOSED.includes(o.status)) {
    r.credit = o.credit + amount;
    r.attention = 'paid-after-close';
    r.events.push(`${kes(amount)} received after the order closed; kept as credit. We’ll be in touch.`);
    r.message = `We received ${kes(amount)} for ${o.ref}, receipt ${receiptNo}, after the order had closed. It’s kept as credit; we’ll be in touch.`;
    return r;
  }

  const due = o.dueNow;
  if (due > 0 && amount < due) {
    r.dueNow = due - amount;
    r.events.push(`Part payment of ${kes(amount)} received; ${kes(r.dueNow)} still due.`);
    r.message = `We received ${kes(amount)} for ${o.ref}, receipt ${receiptNo}. ${kes(r.dueNow)} is still due.`;
    return r;
  }

  const excess = due > 0 ? amount - due : amount;
  if (o.total !== null) {
    const credit = Math.max(0, r.amountPaid - o.total);
    if (credit > o.credit) {
      r.credit = credit;
      r.events.push(`Paid ${kes(credit)} more than the total; kept as credit.`);
    }
  } else if (excess > 0) {
    r.credit = o.credit + excess;
    r.events.push(`${kes(excess)} more than due; kept as credit.`);
  }
  if (due > 0) advance(o, r, receiptNo, today);
  // Money when nothing was due still gets its receipt and a word to the customer.
  else r.message = `We received ${kes(amount)} for ${o.ref}, receipt ${receiptNo}. Thank you.`;
  return r;
}

/**
 * The step is paid: the order moves to its next status.
 * @param {OrderMoney} o
 * @param {Applied} r
 * @param {string} receiptNo
 * @param {string} today
 */
function advance(o, r, receiptNo, today) {
  const purpose = o.duePurpose;
  r.duePurpose = null;
  r.dueNow = 0;
  const paid = purpose === 'full' ? 'Paid in full' : 'Deposit paid';
  if (o.status === 'awaiting_payment') {
    r.stopExpiry = true;
    r.status = 'in_design';
    if (o.mechanism === 'B' && purpose === 'deposit') r.events.push('Deposit paid. A designer is on your job.');
    else if (o.mechanism === 'B') r.events.push('Survey fee paid. Choose your survey date.');
    else if (o.mechanism === 'A' && !o.needsDesign) r.events.push(`${paid}. We’re checking your artwork.`);
    else r.events.push(`${paid}. A designer is on your brief.`);
    r.message = `Payment received for ${o.ref}, receipt ${receiptNo}. We’ve started on your order.`;
  } else if (o.status !== 'awaiting_balance') {
    r.message = `We received the payment for ${o.ref}, receipt ${receiptNo}. Thank you.`;
  } else if (o.status === 'awaiting_balance' && o.mechanism === 'B') {
    r.status = 'completed';
    r.events.push('Balance paid. Thank you!');
    r.message = `Balance received for ${o.ref}, receipt ${receiptNo}. Thank you for working with us.`;
  } else if (o.status === 'awaiting_balance') {
    // The run starts: the promised date counts from today (spec, "Deadline starts at approval").
    r.status = 'in_production';
    r.production = { startedOn: today, promisedDate: addWorkingDays(today, o.leadDays) };
    r.events.push('Balance paid. Your order is in production.');
    r.message = `Balance received for ${o.ref}, receipt ${receiptNo}. Printing has started.`;
  }
}
