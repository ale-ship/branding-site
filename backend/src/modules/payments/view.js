// @ts-check

/**
 * Prompts and payments as the contract's `OrderPayment` (shared/contract/order-types.d.ts): what the
 * order page's pay panel shows. A prompt that was paid carries its payment's receipt numbers.
 *
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderPayment} OrderPayment
 * @typedef {Record<string, any>} Row
 */

/** @param {Date | string | null} t */
const iso = (t) => (t == null ? null : new Date(t).toISOString());

/**
 * A prompt (payment_requests), with the payment it brought in when there is one.
 * @param {Row} r
 * @param {Row | null} p
 * @returns {OrderPayment}
 */
export function toPayment(r, p) {
  return {
    id: r.public_id,
    purpose: r.purpose,
    method: 'stk',
    phone: r.phone,
    amount: p?.amount ?? r.amount,
    status: r.status,
    mpesaReceipt: p?.mpesa_receipt ?? null,
    receiptNo: p?.receipt_no ?? null,
    requestedAt: /** @type {string} */ (iso(r.created_at)),
    settledAt: iso(r.settled_at),
    message: r.message ?? null,
  };
}

/**
 * Money that came without a prompt (Paybill).
 * @param {Row} p
 * @returns {OrderPayment}
 */
export function toPaybillPayment(p) {
  return {
    id: p.public_id,
    purpose: p.purpose,
    method: p.method,
    phone: p.phone,
    amount: p.amount,
    status: 'confirmed',
    mpesaReceipt: p.mpesa_receipt,
    receiptNo: p.receipt_no,
    requestedAt: /** @type {string} */ (iso(p.created_at)),
    settledAt: iso(p.created_at),
    message: null,
  };
}

/**
 * An order's prompts and payments, oldest first.
 * @param {Row[]} requests
 * @param {Row[]} payments
 * @returns {OrderPayment[]}
 */
export function paymentsOf(requests, payments) {
  const byRequest = new Map(payments.filter((p) => p.request_id != null).map((p) => [p.request_id, p]));
  return [...requests.map((r) => toPayment(r, byRequest.get(r.id) ?? null)), ...payments.filter((p) => p.request_id == null).map(toPaybillPayment)].sort(
    (a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt),
  );
}
