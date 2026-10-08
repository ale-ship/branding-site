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
    case 'payment-received':
      return `Payment received for ${ref}${payload.receiptNo ? `, receipt ${payload.receiptNo}` : ''}`;
    default:
      return `Your order ${ref}`;
  }
}
