// @ts-check

/**
 * The words of each message (docs/ORDER_WORKFLOW_SPEC.md, "Notifications"), one function per event.
 * The same text goes on WhatsApp and by email; the WhatsApp Cloud API sends it through an approved
 * template with these values once it goes live.
 */

/**
 * @param {{ name: string; ref: string; dueNow: number }} o
 * @returns {string}
 */
export const orderPlaced = ({ name, ref, dueNow }) =>
  `Thank you, ${name.trim().split(/\s+/)[0]}. Order ${ref} is placed: pay KES ${dueNow.toLocaleString('en-KE')} to start.`;
