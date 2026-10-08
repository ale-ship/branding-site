// @ts-check
import { paymentsOf } from '../payments/view.js';

/**
 * A stored order as the contract's `Order` (shared/contract/order-types.d.ts): what the site's order
 * page reads. Proofs, deliveries, the site quote and company orders have their tables from step B5;
 * until then they are empty, which is exactly what an order has before its design starts.
 *
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').Order} Order
 * @typedef {Record<string, any>} Row
 */

/**
 * The whole order's delivery, once it is out (early, partial deliveries come with B5).
 * @param {Row} r
 * @returns {Order['deliveries']}
 */
function deliveriesOf(r) {
  if (!r.dispatch) return [];
  const delivered = r.handed_over?.method === 'delivery';
  return [
    {
      id: `${r.order_no}-D1`,
      pieces: r.quantity,
      partial: false,
      status: delivered ? 'delivered' : 'out',
      rider: r.dispatch.rider || null,
      riderPhone: r.dispatch.riderPhone || null,
      waybill: r.dispatch.waybill || null,
      recipient: delivered ? (r.handed_over.recipient ?? null) : null,
      requestedAt: r.dispatch.at,
      deliveredAt: delivered ? r.handed_over.at : null,
    },
  ];
}

/** @param {Date | string | null} t */
const iso = (t) => (t == null ? null : new Date(t).toISOString());

/**
 * @param {Row} r The order row, with `invoice_no`.
 * @param {{ events: Row[]; notifications: Row[]; requests?: Row[]; payments?: Row[]; logs?: Row[] }} history
 * @returns {Order}
 */
export function toOrder(r, { events, notifications, requests = [], payments = [], logs = [] }) {
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
    payments: paymentsOf(requests, payments),
    events: events.map((e) => ({ at: /** @type {string} */ (iso(e.at)), text: e.text })),
    notifications: notifications.map((n) => ({ at: /** @type {string} */ (iso(n.created_at)), channel: n.channel, to: n.recipient, text: n.payload.text })),
    progress: r.progress,
    proofs: [],
    survey: r.survey,
    siteQuote: null,
    installDate: null,
    sample: r.sample,
    production: {
      logs: logs.map((l) => ({ at: /** @type {string} */ (iso(l.at)), pieces: l.pieces, note: l.note })),
      dailyCapacity: r.daily_capacity,
      startedOn: r.started_on,
      promisedBy: r.promised_date,
    },
    pickupCode: r.pickup_code ?? null,
    deliveries: deliveriesOf(r),
    handedOver: r.handed_over ? { at: r.handed_over.at, method: r.handed_over.method, detail: r.handed_over.detail } : null,
    company: null,
  };
}
