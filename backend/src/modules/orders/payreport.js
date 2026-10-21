// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { reportedReference } from '@noorcom-branding/shared/rules/manual-payment.js';

/**
 * The customer says they've paid (owner, 21 Oct 2026): until the M-Pesa prompt is connected,
 * customers pay to the Paybill on their order page and tell us their M-Pesa code here. Pure like
 * flow.js. The order does NOT move: it is flagged for staff, who check the money arrived and record
 * it in the back office (backoffice/payments.service.js), which is what moves it on.
 *
 * @typedef {Record<string, any>} Row
 * @typedef {import('../backoffice/steps.js').Step} Step
 */

/** @param {number} n */
const kes = (n) => `KES ${n.toLocaleString('en-KE')}`;

/**
 * @param {Row} o
 * @param {string} rawCode The M-Pesa code or bank reference, as typed.
 * @param {number | null} amount What they say they paid, if they gave it.
 * @param {Date} now
 * @returns {Step}
 */
export function reportPayment(o, rawCode, amount, now) {
  if (!['awaiting_payment', 'awaiting_balance'].includes(o.status) || o.due_now <= 0) {
    throw new OrderError('invalid_state', 'Nothing is due on this order right now.');
  }
  const code = reportedReference(rawCode);
  if (!code) throw new OrderError('invalid', 'Enter the code from your M-Pesa message, like TJK4XY12AB.');
  if (amount !== null && (!Number.isInteger(amount) || amount < 1 || amount > 10_000_000)) {
    throw new OrderError('invalid', 'Enter the amount you paid in shillings, like 14250.');
  }
  if (o.payment_report?.code === code) throw new OrderError('invalid_state', 'We already have that code; we’re checking it.');

  const paid = amount === null ? '' : ` ${kes(amount)}`;
  return {
    fields: { payment_report: { code, amount, at: now.toISOString() }, attention: 'payment-reported' },
    events: [`You told us you paid${paid} (reference ${code}). We’re checking it.`],
    message: {
      template: 'payment-reported',
      text: `Thank you. We’ve got your payment reference ${code} for ${o.order_no} and we’re checking it; we’ll confirm as soon as it’s in.`,
    },
    audit: {},
    staffEmail: {
      template: 'payment-check',
      text: [
        `${o.customer_name} says they paid${paid} for ${o.order_no}, reference ${code}.`,
        `Due on the order: ${kes(o.due_now)}.`,
        '',
        'Check it on the Paybill statement, then record it on the order in the back office.',
      ].join('\n'),
    },
  };
}
