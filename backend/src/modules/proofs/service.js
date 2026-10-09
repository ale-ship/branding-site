// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { randomBytes } from 'node:crypto';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { imageInfo, watermarkSvg } from '../../lib/images.js';
import { approvalOf, approvesFor } from '../accounts/company.service.js';
import { emailFromSession } from '../accounts/session.service.js';
import { updateOrder } from '../backoffice/repo.js';
import { queueNotifications } from '../notifications/service.js';
import { findByOrderNo, insertEvent, insertNotifications } from '../orders/repo.js';
import { findOrderFor, getOrder } from '../orders/service.js';
import { audit } from '../staff/repo.js';
import * as decide from './decide.js';
import * as repo from './repo.js';

/**
 * Proofs (docs/ORDER_WORKFLOW_SPEC.md, "Proofs and approval"): a designer uploads one, the customer
 * approves it with the checklist or asks for changes with notes and pins. Nothing is printed until a
 * proof is approved.
 *
 * Files are stored before the transaction (storage may be a network call); a failed transaction
 * leaves an unused file, never a proof without one.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../staff/repo.js').Staff} Staff
 */

export const MAX_PROOF_BYTES = 10 * 1024 * 1024;

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool || !deps.storage) throw new AppError(503, 'unavailable', 'Proofs are unavailable for a moment.');
  return { pool: deps.pool, storage: deps.storage };
}

/**
 * Writes the outcome of a step on a locked order: fields, events, the customer's message.
 * @param {import('pg').PoolClient} trx
 * @param {Record<string, any>} order
 * @param {decide.Outcome} o
 * @param {Date} now
 * @returns {Promise<number[]>} Message ids to queue after commit.
 */
async function apply(trx, order, o, now) {
  await updateOrder(trx, order.id, o.fields, now);
  for (const text of o.events) await insertEvent(trx, order.id, text, now);
  if (!o.message) return [];
  const payload = { text: o.message.text, ref: order.order_no };
  return insertNotifications(
    trx,
    order.id,
    [
      { channel: 'whatsapp', recipient: order.customer_phone, template: o.message.template, payload },
      { channel: 'email', recipient: order.customer_email, template: o.message.template, payload },
    ],
    now,
  );
}

/**
 * A designer uploads the next proof (PNG or JPEG). The customer sees it watermarked PROOF.
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {string} ref
 * @param {Buffer} image
 * @param {string} note
 * @param {Date} [now]
 */
export async function uploadProof(deps, staff, ref, image, note, now = new Date()) {
  const { pool, storage } = need(deps);
  const info = Buffer.isBuffer(image) ? imageInfo(image) : null;
  if (!info) throw new OrderError('invalid', 'Upload the proof as a PNG or JPEG image.');
  const orderNo = ref.trim().toUpperCase();
  const id = randomBytes(8).toString('hex');
  const fileKey = `proofs/${orderNo}/${id}.svg`;
  const originalKey = `proofs/${orderNo}/${id}-original.${info.type === 'image/png' ? 'png' : 'jpg'}`;
  await storage.put(originalKey, image, info.type);
  await storage.put(fileKey, watermarkSvg(image, info), 'image/svg+xml');

  const ids = await withTransaction(pool, async (trx) => {
    const order = await findByOrderNo(trx, orderNo, { lock: true });
    if (!order) throw new OrderError('not_found', 'There is no order with that number.');
    if (order.status !== 'in_design') throw new OrderError('invalid_state', 'Proofs are uploaded while the order is in design.');
    const version = ((await repo.latestProof(trx, order.id))?.version ?? 0) + 1;
    // The order page reads the note as a sentence, so it ends with a full stop.
    const said = note.trim().replace(/([^.!?])$/, '$1.');
    await repo.insertProof(trx, { orderId: order.id, version, note: said || (version === 1 ? 'First proof.' : 'Revised as you asked.'), fileKey, originalKey, staffId: staff.id, at: now });
    await audit(trx, staff.id, 'proof-uploaded', order.id, { version, width: info.width, height: info.height });
    return apply(
      trx,
      order,
      {
        fields: { status: 'awaiting_approval' },
        events: [`Proof v${version} is ready for you to check.`],
        message: { template: 'proof-ready', text: `Proof v${version} for ${order.order_no} is ready. Approve it or ask for changes on your order page.` },
      },
      now,
    );
  });
  await queueNotifications(deps, ids);
}

/**
 * The customer answers the newest proof.
 * @param {Deps} deps
 * @param {string} ref
 * @param {import('../../middleware/customerAccess.js').Access} access
 * @param {(order: Record<string, any>, proof: Record<string, any> | null, today: string) => decide.Outcome & { comments?: string }} rule
 * @param {(proof: Record<string, any>, o: decide.Outcome & { comments?: string }) => Parameters<typeof repo.decide>[2]} record
 * @param {Date} now
 */
async function answer(deps, ref, access, rule, record, now) {
  const { pool } = need(deps);
  const { order_no: orderNo } = await findOrderFor(deps, ref, access, now);
  const ids = await withTransaction(pool, async (trx) => {
    const order = /** @type {Record<string, any>} */ (await findByOrderNo(trx, orderNo, { lock: true }));
    const proof = await repo.latestProof(trx, order.id, { lock: true });
    const outcome = rule(order, proof, nairobiToday(now));
    await repo.decide(trx, /** @type {Record<string, any>} */ (proof).id, record(/** @type {Record<string, any>} */ (proof), outcome));
    return apply(trx, order, outcome, now);
  });
  await queueNotifications(deps, ids);
  return getOrder(deps, orderNo, access, now);
}

/**
 * @param {Deps} deps
 * @param {string} ref
 * @param {import('../../middleware/customerAccess.js').Access} access
 * @param {number} version
 * @param {import('@noorcom-branding/shared/contract/order-types.js').ApprovalChecklist} checklist
 * @param {Date} [now]
 */
export async function approveProof(deps, ref, access, version, checklist, now = new Date()) {
  const order = await findOrderFor(deps, ref, access, now);
  if (order.company_id) await checkApprover(deps, order, access);
  return answer(deps, ref, access, (o, p, today) => decide.approve(o, p, version, checklist, today), () => ({ status: 'approved', checklist, at: now }), now);
}

/**
 * A company order's proof is approved by the company's owner or an approver (spec, "company
 * accounts"): the signed-in account, or, by the link or phone, the member who ordered.
 * @param {Deps} deps
 * @param {Record<string, any>} order
 * @param {import('../../middleware/customerAccess.js').Access} access
 */
async function checkApprover(deps, order, access) {
  const who = 'session' in access ? await emailFromSession(deps, access.session) : order.customer_email;
  if (await approvesFor(deps, order.company_id, who)) return;
  const company = await approvalOf(deps, order.company_id);
  const by = company?.approvers.join(' or ') || 'the company’s approver';
  throw new OrderError('invalid_state', `Proofs for ${company?.name ?? 'this company'} are approved by ${by}. Ask them to sign in and approve.`);
}

/**
 * @param {Deps} deps
 * @param {string} ref
 * @param {import('../../middleware/customerAccess.js').Access} access
 * @param {number} version
 * @param {string} comments
 * @param {import('@noorcom-branding/shared/contract/order-types.js').ProofPin[]} pins
 * @param {Date} [now]
 */
export const requestChanges = (deps, ref, access, version, comments, pins, now = new Date()) =>
  answer(
    deps,
    ref,
    access,
    (o, p) => decide.requestChanges(o, p, version, comments, pins),
    (_p, o) => ({ status: 'changes_requested', comments: o.comments || null, pins, at: now }),
    now,
  );

/**
 * A proof's original file, for staff.
 * @param {Deps} deps
 * @param {string} ref
 * @param {number} version
 */
export async function originalProof(deps, ref, version) {
  const { pool, storage } = need(deps);
  const files = await repo.proofFiles(pool, ref.trim().toUpperCase(), version);
  const file = files ? await storage.get(files.original_key) : null;
  if (!file) throw new OrderError('not_found', 'No such proof.');
  return file;
}
