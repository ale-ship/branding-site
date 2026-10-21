// @ts-check

/**
 * Payments recorded by hand (owner, 21 Oct 2026): until the M-Pesa prompt is connected, customers
 * pay to the Paybill on their invoice and staff record the payment in the back office. These rules
 * check the reference the customer reports and the one staff type in; the backend and the site
 * share them.
 *
 * @typedef {import('../contract/order-types.js').PaymentChannel} PaymentChannel
 */

/** The channels staff can record, in the order the form offers them. */
export const PAYMENT_CHANNELS = /** @type {const} */ (['mpesa', 'bank', 'cash']);

/** @type {Record<PaymentChannel, string>} */
export const CHANNEL_LABEL = { mpesa: 'M-Pesa', bank: 'Bank transfer', cash: 'Cash' };

/** An M-Pesa transaction code: ten letters and digits, like TJK4XY12AB. */
const MPESA = /^[A-Z0-9]{10}$/;
/** A bank reference: 4 to 30 letters, digits, dashes and slashes. */
const BANK = /^[A-Z0-9][A-Z0-9/-]{3,29}$/;

/**
 * A reference made comparable: spaces gone, capitals.
 * @param {string} raw
 */
export const cleanReference = (raw) => raw.replace(/\s+/g, '').toUpperCase();

/**
 * The reference for a channel, or null when it isn't one. Cash has none (staff get a receipt number).
 * @param {PaymentChannel} channel
 * @param {string} raw
 * @returns {string | null}
 */
export function paymentReference(channel, raw) {
  const ref = cleanReference(raw);
  if (channel === 'cash') return '';
  if (channel === 'mpesa') return MPESA.test(ref) ? ref : null;
  return BANK.test(ref) ? ref : null;
}

/**
 * What the customer types as proof of payment: an M-Pesa code or a bank reference.
 * @param {string} raw
 * @returns {string | null}
 */
export const reportedReference = (raw) => paymentReference('mpesa', raw) ?? paymentReference('bank', raw);
