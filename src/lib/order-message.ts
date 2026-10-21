import type { Order } from './api/order-types';
import { formatDay } from './calendar';
import { PURPOSE_LABEL } from './order-status';
import { invoiceIssuer } from './site';

/**
 * The WhatsApp message a customer sends us after ordering (payments by hand, owner, 21 Oct 2026):
 * everything they chose, the price and how they're paying, so the designer on the front desk has the
 * whole order in the chat. Pure; the order page opens it in WhatsApp with the text filled in.
 */

const kes = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

export function orderWhatsAppText(
  order: Order,
  opts: {
    /** The brief in words (`describeBrief`). */
    briefRows: { label: string; value: string }[];
    /** How it reaches them, in words. */
    handover: string;
    /** The order page's link, with its key, so we can open the same page. */
    link: string;
  },
): string {
  const e = order.estimate;
  const c = order.common;
  const what = order.mechanism === 'A' ? `${order.product.name} × ${order.quantity.toLocaleString('en-KE')} pieces` : order.product.name;
  const lines = [`Hello Noorcom Branding, I’ve placed order ${order.ref} on your website.`, '', `*${what}*`];
  for (const r of opts.briefRows) lines.push(`${r.label}: ${r.value}`);

  lines.push('', order.needsDesign ? 'Design: please design it for me' : 'Design: I have print-ready artwork');
  if (c.assets.length) lines.push(`Files: ${c.assets.map((f) => f.name).join(', ')}`);
  if (c.text) lines.push(`Text on it: ${c.text}`);
  if (c.colours.length) lines.push(`Colours: ${c.colours.join(', ')}`);
  if (c.fonts) lines.push(`Fonts: ${c.fonts}`);
  if (c.styles.length) lines.push(`Style: ${c.styles.join(', ')}`);
  if (c.inspirationLinks.length) lines.push(`Inspiration: ${c.inspirationLinks.join(' ')}`);
  if (c.notes) lines.push(`Notes: ${c.notes}`);

  lines.push('', `Deadline: ${e.urgency.label}${e.readyBy ? `, ready by ${formatDay(e.readyBy)}` : ''}`, `Handover: ${opts.handover}`);
  const total = order.total ?? e.total;
  lines.push('', ...(total !== null ? [`Total: ${kes(total)}`] : []));
  if (order.dueNow > 0) {
    lines.push(
      `To pay now: ${kes(order.dueNow)}${order.duePurpose ? ` (${PURPOSE_LABEL[order.duePurpose].toLowerCase()})` : ''}`,
      `Paybill ${invoiceIssuer.paybill}, account ${invoiceIssuer.paybillAccount(order.ref)}`,
    );
  }

  const who = [order.customer.name, order.customer.company].filter(Boolean).join(', ');
  lines.push('', `${who} · ${order.customer.phone} · ${order.customer.email}`, `Order page: ${opts.link}`);
  return lines.join('\n');
}
