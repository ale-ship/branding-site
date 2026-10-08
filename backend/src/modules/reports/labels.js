// @ts-check

/** Words and formats for the reports: statuses, payment kinds, money and Nairobi dates. */

export const STATUS = /** @type {Record<string, string>} */ ({
  awaiting_payment: 'Awaiting payment',
  in_design: 'In design',
  awaiting_approval: 'Awaiting approval',
  awaiting_balance: 'Awaiting balance',
  in_production: 'In production',
  ready: 'Ready',
  out_for_handover: 'Out for handover',
  completed: 'Completed',
  expired: 'Expired',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
});
export const PURPOSE = /** @type {Record<string, string>} */ ({ deposit: 'Deposit', full: 'Full payment', survey_fee: 'Survey fee', balance: 'Balance' });
export const METHOD = /** @type {Record<string, string>} */ ({ stk: 'M-Pesa prompt', paybill: 'Paybill' });
export const REASON = /** @type {Record<string, string>} */ ({
  'unknown-order': 'Order number not found',
  ambiguous: 'More than one order fits',
  'no-match': 'No order fits',
  'wrong-shortcode': 'Paid to another Paybill',
  unreadable: 'Unreadable confirmation',
  'receipt-seen-before': 'Receipt seen before',
});

export const number = new Intl.NumberFormat('en-KE');
export const kes = (/** @type {number} */ n) => `KES ${number.format(n)}`;

/** @param {string} ymd */
export const dayLabel = (ymd) => new Date(`${ymd}T12:00:00+03:00`).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric' });
/** @param {{ from: string; to: string }} p */
export const periodLabel = ({ from, to }) => (from === to ? dayLabel(from) : `${dayLabel(from)} to ${dayLabel(to)}`);
