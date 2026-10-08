// @ts-check

/**
 * The words of each message (docs/ORDER_WORKFLOW_SPEC.md, "Notifications"), one function per event.
 * The same text goes on WhatsApp and by email; the WhatsApp Cloud API sends it through an approved
 * template with these values once it goes live. The payment messages' words are worked out with the
 * money (modules/payments/apply.js).
 */

/**
 * @param {{ name: string; ref: string; dueNow: number }} o
 * @returns {string}
 */
export const orderPlaced = ({ name, ref, dueNow }) =>
  `Thank you, ${name.trim().split(/\s+/)[0]}. Order ${ref} is placed: pay KES ${dueNow.toLocaleString('en-KE')} to start.`;

/**
 * An email's subject line, by template.
 * @param {string} template
 * @param {{ ref?: string; receiptNo?: string }} payload
 * @returns {string}
 */
export function subjectFor(template, payload) {
  const ref = payload.ref ?? '';
  switch (template) {
    case 'order-placed':
      return `Order ${ref} is placed`;
    case 'proof-ready':
      return `Your proof for ${ref} is ready to check`;
    case 'balance-due':
      return `Proof approved for ${ref}: the balance is due`;
    case 'design-approved':
      return `Design approved for ${ref}`;
    case 'ready':
      return `Order ${ref} is ready`;
    case 'out-for-delivery':
      return `Order ${ref} is on its way`;
    case 'completed':
      return `Order ${ref} is complete`;
    case 'cancelled':
      return `Order ${ref} has been cancelled`;
    case 'payment-received':
      return `Payment received for ${ref}${payload.receiptNo ? `, receipt ${payload.receiptNo}` : ''}`;
    default:
      return `Your order ${ref}`;
  }
}

/** The words for the staff steps (B4), by event. */
export const staffMessages = {
  /** @param {string} ref @param {string} code */
  readyForPickup: (ref, code) => `Your order ${ref} is ready for pickup. Your pickup code is ${code}: show it at the counter.`,
  /** @param {string} ref */
  readyForDelivery: (ref) => `Your order ${ref} is ready. We’ll send it out for delivery shortly.`,
  /** @param {string} ref @param {{ rider: string; riderPhone: string; waybill: string }} d */
  outForDelivery: (ref, d) =>
    d.waybill ? `Your order ${ref} is on its way by courier, waybill ${d.waybill}.` : `Your order ${ref} is out for delivery with ${d.rider} (${d.riderPhone}).`,
  /** @param {string} ref */
  completed: (ref) => `Order ${ref} is complete. Thank you for working with Noorcom Branding! We’d love a review.`,
  /** @param {string} ref @param {boolean} refundDue */
  cancelled: (ref, refundDue) => `Order ${ref} has been cancelled.${refundDue ? ' We will be in touch about what you paid.' : ''}`,
};
