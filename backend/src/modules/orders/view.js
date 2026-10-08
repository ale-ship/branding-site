// @ts-check

/**
 * A stored order as the contract's `Order` (shared/contract/order-types.d.ts): what the site's order
 * page reads. Payments, proofs, deliveries, the site quote and company orders have their tables from
 * steps B3 and B5; until then they are empty, which is exactly what a newly placed order has.
 *
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').Order} Order
 * @typedef {Record<string, any>} Row
 */

/** @param {Date | string | null} t */
const iso = (t) => (t == null ? null : new Date(t).toISOString());

/**
 * @param {Row} r The order row, with `invoice_no`.
 * @param {{ events: Row[]; notifications: Row[] }} history
 * @returns {Order}
 */
export function toOrder(r, { events, notifications }) {
  return {
    ref: r.order_no,
    invoiceNo: r.invoice_no,
    createdAt: /** @type {string} */ (iso(r.created_at)),
    expiresAt: iso(r.expires_at),
    status: r.status,
    mechanism: r.mechanism,
    product: r.product,
    quantity: r.quantity,
    brief: r.brief,
    common: r.common,
    needsDesign: r.needs_design,
    urgency: r.urgency,
    handover: r.handover,
    customer: { name: r.customer_name, company: r.customer_company, phone: r.customer_phone, email: r.customer_email },
    estimate: r.estimate,
    total: r.total,
    amountPaid: r.amount_paid,
    credit: r.credit,
    dueNow: r.due_now,
    duePurpose: r.due_purpose,
    payments: [],
    events: events.map((e) => ({ at: /** @type {string} */ (iso(e.at)), text: e.text })),
    notifications: notifications.map((n) => ({ at: /** @type {string} */ (iso(n.created_at)), channel: n.channel, to: n.recipient, text: n.payload.text })),
    progress: r.progress,
    proofs: [],
    survey: r.survey,
    siteQuote: null,
    installDate: null,
    sample: r.sample,
    production: { logs: [], dailyCapacity: r.daily_capacity, startedOn: r.started_on, promisedBy: r.promised_date },
    pickupCode: null,
    deliveries: [],
    handedOver: null,
    company: null,
  };
}
