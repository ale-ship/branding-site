// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { partialDeliveryError } from '@noorcom-branding/shared/rules/production.js';

/**
 * The rest of an order's steps (B5), pure like backoffice/steps.js: the services lock the order, ask
 * here, and write the answer. As the site's mock does them (src/lib/api/mock-orders.ts).
 *
 *   Pre-production sample (A, 200+ pieces): staff photograph one piece → the customer approves it
 *     (the full run may then be logged) or asks for changes (staff print another).
 *   Early deliveries (A, delivered, in production): the customer asks for finished pieces → staff
 *     send them out → delivered. One open at a time.
 *   Design only (C): after approval staff upload the final files → "files sent" completes it.
 *
 * @typedef {Record<string, any>} Row
 * @typedef {import('../backoffice/steps.js').Step} Step
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').Delivery} Delivery
 */

const MAX_NOTES = 2000;

// ── The pre-production sample ─────────────────────────────────────────────────

/**
 * Staff uploaded the sample's photo.
 * @param {Row} o
 * @param {string} photoKey
 * @param {Date} now
 * @returns {Step}
 */
export function sampleReady(o, photoKey, now) {
  if (o.status !== 'in_production' || !o.sample) throw new OrderError('invalid_state', 'This order doesn’t need a sample now.');
  if (o.sample.status === 'pending') throw new OrderError('invalid_state', 'The customer hasn’t answered the last sample yet.');
  if (o.sample.status === 'approved') throw new OrderError('invalid_state', 'The sample is already approved.');
  return {
    fields: { sample: { status: 'pending', photoKey, uploadedAt: now.toISOString(), comments: null } },
    events: ['A sample is printed for you to check before the full run.'],
    message: { template: 'sample-ready', text: `A sample of ${o.order_no} is ready: check the photo on your order page and approve it to start the full run.` },
    audit: {},
  };
}

/**
 * The customer's answer to the sample.
 * @param {Row} o
 * @param {'approve' | 'changes'} decision
 * @param {string} comments
 * @returns {Step}
 */
export function reviewSample(o, decision, comments) {
  if (o.status !== 'in_production' || o.sample?.status !== 'pending') throw new OrderError('invalid_state', 'There’s no sample waiting for you.');
  if (decision === 'approve') {
    return { fields: { sample: { ...o.sample, status: 'approved' } }, events: ['Sample approved; the full run is printing.'], message: null, audit: {} };
  }
  const text = comments.trim().slice(0, MAX_NOTES);
  if (text.length < 5) throw new OrderError('invalid', 'Tell us what to change on the sample.');
  return {
    fields: { sample: { ...o.sample, status: 'changes_requested', comments: text } },
    events: ['Changes asked for on the sample; we’ll print a new one.'],
    message: null,
    audit: {},
  };
}

/**
 * Whether the run may be logged: a sample, when there is one, must be approved first.
 * @param {Row} o
 */
export function sampleBlocksRun(o) {
  return !!o.sample && o.sample.status !== 'approved';
}

// ── Early (partial) deliveries ────────────────────────────────────────────────

/** @param {Row} o @returns {Delivery[]} */
const early = (o) => o.early_deliveries ?? [];

/**
 * @param {Row} o
 * @param {number} pieces
 * @param {Date} now
 * @returns {Step}
 */
export function requestEarlyDelivery(o, pieces, now) {
  if (o.mechanism !== 'A' || o.status !== 'in_production' || o.handover?.method !== 'delivery' || o.progress?.kind !== 'pieces') {
    throw new OrderError('invalid_state', 'Early deliveries are for delivered orders in production.');
  }
  const problem = partialDeliveryError(pieces, o.progress.done, o.progress.total, early(o));
  if (problem) throw new OrderError('invalid', problem);
  /** @type {Delivery} */
  const d = { id: `${o.order_no}-E${early(o).length + 1}`, pieces, partial: true, status: 'requested', rider: null, riderPhone: null, waybill: null, recipient: null, requestedAt: now.toISOString(), deliveredAt: null };
  return {
    fields: { early_deliveries: [...early(o), d] },
    events: [`Early delivery of ${pieces.toLocaleString('en-KE')} pieces asked for.`],
    message: null,
    audit: { pieces },
  };
}

/**
 * Staff send the open early delivery out, or mark it delivered.
 * @param {Row} o
 * @param {{ rider?: string; riderPhone?: string; waybill?: string; recipient?: string }} d
 * @param {Date} now
 * @returns {Step}
 */
export function moveEarlyDelivery(o, d, now) {
  const list = early(o);
  const open = list.find((x) => x.status !== 'delivered');
  if (!open) throw new OrderError('invalid_state', 'No early delivery is waiting.');
  const what = `${open.pieces.toLocaleString('en-KE')} pieces`;
  if (open.status === 'requested') {
    if (!d.waybill && !(d.rider && d.riderPhone)) throw new OrderError('invalid', 'Give the rider’s name and phone, or the courier’s waybill number.');
    const sent = { ...open, status: /** @type {const} */ ('out'), rider: d.rider || null, riderPhone: d.riderPhone || null, waybill: d.waybill || null };
    return {
      fields: { early_deliveries: list.map((x) => (x.id === open.id ? sent : x)) },
      events: [d.waybill ? `${what} sent by courier, waybill ${d.waybill}.` : `${what} out with ${d.rider}.`],
      message: { template: 'out-for-delivery', text: d.waybill ? `${o.order_no}: ${what} are with the courier, waybill ${d.waybill}.` : `${o.order_no}: ${what} are on the way with ${d.rider}, ${d.riderPhone}.` },
      audit: { id: open.id, ...d },
    };
  }
  if (!d.recipient?.trim()) throw new OrderError('invalid', 'Enter who received it.');
  const done = { ...open, status: /** @type {const} */ ('delivered'), recipient: d.recipient.trim(), deliveredAt: now.toISOString() };
  return {
    fields: { early_deliveries: list.map((x) => (x.id === open.id ? done : x)) },
    events: [`${what} delivered, received by ${done.recipient}.`],
    message: null,
    audit: { id: open.id, recipient: done.recipient },
  };
}

/**
 * Pieces still to go when the whole order is sent: the total less the early deliveries.
 * @param {Row} o
 */
export const piecesLeftToSend = (o) => o.quantity - early(o).reduce((s, d) => s + d.pieces, 0);

// ── Design only: the final files ───────────────────────────────────────────────

/**
 * Staff have uploaded the final files and send them: the order is complete.
 * @param {Row} o
 * @param {number} files
 * @param {Date} now
 * @returns {Step}
 */
export function filesSent(o, files, now) {
  if (o.mechanism !== 'C' || o.status !== 'out_for_handover') throw new OrderError('invalid_state', 'Final files are sent once the design is approved.');
  if (files < 1) throw new OrderError('invalid_state', 'Upload the final files first.');
  const detail = `${files} final ${files === 1 ? 'file' : 'files'} sent, on the order page.`;
  return {
    fields: { status: 'completed', handed_over: { at: now.toISOString(), method: 'digital', detail, recipient: null } },
    events: [detail, 'Order complete. Thank you!'],
    message: { template: 'files-ready', text: `Your final files for ${o.order_no} are ready: download them from your order page. Thank you for working with Noorcom Branding!` },
    audit: { files },
  };
}

/**
 * The final files may be added or removed until they are sent.
 * @param {Row} o
 */
export function checkFinalsOpen(o) {
  if (o.mechanism !== 'C') throw new OrderError('invalid_state', 'Final files are for design-only orders.');
  if (o.status !== 'out_for_handover') throw new OrderError('invalid_state', 'Final files are added after the customer approves the design, until they are sent.');
}
