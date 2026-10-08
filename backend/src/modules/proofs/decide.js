// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { addWorkingDays } from '@noorcom-branding/shared/rules/calendar.js';
import { changeRequestError, checklistComplete, MAX_CHANGE_NOTES } from '@noorcom-branding/shared/rules/proof.js';

/**
 * What the customer's answer to a proof does to the order (docs/ORDER_WORKFLOW_SPEC.md, "Proofs and
 * approval"). Pure, and the same rules as the site's mock (src/lib/api/mock-orders.ts,
 * `approveProof`, `requestChanges`):
 *
 * - approve: the artwork locks. Design only (C) goes out as files; a site job (B) ticks "Design
 *   approved" and starts production; a run (A) asks for the balance if one is left, else starts.
 * - changes: back to design with the notes and pins; a design-only order uses a revision round.
 *
 * Company orders (approved by an owner or approver) come with accounts on the API (B5).
 *
 * @typedef {Record<string, any>} Row
 * @typedef {{ fields: Record<string, unknown>; events: string[]; message: { template: string; text: string } | null }} Outcome
 */

/** @param {number} n */
const kes = (n) => `KES ${n.toLocaleString('en-KE')}`;

/**
 * @param {Row} order
 * @param {Row | null} proof The newest proof.
 * @param {number} version What the customer answered.
 * @param {string} what For the refusal.
 */
function check(order, proof, version, what) {
  if (order.status !== 'awaiting_approval' || !proof || proof.version !== version || proof.status !== 'pending') {
    throw new OrderError('invalid_state', `That proof can’t be ${what} now.`);
  }
}

/**
 * @param {Row} order
 * @param {Row | null} proof
 * @param {number} version
 * @param {import('@noorcom-branding/shared/contract/order-types.js').ApprovalChecklist} checklist
 * @param {string} today
 * @returns {Outcome}
 */
export function approve(order, proof, version, checklist, today) {
  check(order, proof, version, 'approved');
  if (!checklistComplete(checklist)) throw new OrderError('invalid', 'Tick every item on the checklist to approve.');
  const events = [`Proof v${version} approved; the artwork is locked.`];
  const start = { started_on: today, promised_date: addWorkingDays(today, order.estimate.leadDays), status: 'in_production' };

  if (order.mechanism === 'C') {
    return { fields: { status: 'out_for_handover' }, events: [...events, 'Your final files are ready to download.'], message: null };
  }
  if (order.mechanism === 'B') {
    const p = order.progress;
    const stages = p.stages.map((/** @type {{ name: string; done: boolean }} */ s) => (s.name === 'Design approved' ? { ...s, done: true } : s));
    const done = stages.filter((/** @type {{ done: boolean }} */ s) => s.done).length;
    return {
      fields: { ...start, progress: { ...p, stages, done } },
      events: [...events, 'Design approved. Materials go to print; choose your installation date.'],
      message: { template: 'design-approved', text: `Design approved for ${order.order_no}. Choose your installation date on your order page.` },
    };
  }
  const balance = order.total !== null ? order.total - order.amount_paid : 0;
  if (balance > 0) {
    return {
      fields: { status: 'awaiting_balance', due_now: balance, due_purpose: 'balance' },
      events: [...events, `Pay the balance of ${kes(balance)} and printing starts.`],
      message: { template: 'balance-due', text: `Proof approved for ${order.order_no}. Pay the balance of ${kes(balance)} to start printing.` },
    };
  }
  return { fields: start, events: [...events, 'Proof approved; your order is in production.'], message: null };
}

/**
 * @param {Row} order
 * @param {Row | null} proof
 * @param {number} version
 * @param {string} comments
 * @param {import('@noorcom-branding/shared/contract/order-types.js').ProofPin[]} pins
 * @returns {Outcome & { comments: string }}
 */
export function requestChanges(order, proof, version, comments, pins) {
  check(order, proof, version, 'changed');
  const text = comments.trim().slice(0, MAX_CHANGE_NOTES);
  const problem = changeRequestError(text, pins);
  if (problem) throw new OrderError('invalid', problem);
  const p = order.progress;
  const progress = p.kind === 'rounds' ? { ...p, done: Math.min(p.total + 5, p.done + 1) } : p;
  const notes = pins.length ? ` (${pins.length} pinned note${pins.length === 1 ? '' : 's'})` : '';
  return { fields: { status: 'in_design', progress }, events: [`Changes requested on proof v${version}${notes}.`], message: null, comments: text };
}
