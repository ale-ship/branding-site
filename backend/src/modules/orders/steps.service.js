// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { updateOrder } from '../backoffice/repo.js';
import { queueNotifications } from '../notifications/service.js';
import { audit } from '../staff/repo.js';
import { findByOrderNo, insertEvent, insertNotifications } from './repo.js';
import { findOrderFor, getOrder } from './service.js';

/**
 * Runs one step on an order (the rules in backoffice/steps.js, flow.js and sitejob.js say what it
 * does): in one transaction with the order locked, the order's new fields, its events, the
 * customer's WhatsApp and email, and for staff the audit row. The messages are queued after commit.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../backoffice/steps.js').Step} Step
 * @typedef {import('../../middleware/customerAccess.js').Access} Access
 * @typedef {(trx: import('pg').PoolClient, order: Record<string, any>) => Promise<void>} Extra
 */

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'Orders are unavailable for a moment. Please try again shortly.');
  return deps.pool;
}

/**
 * @param {import('pg').PoolClient} trx
 * @param {Record<string, any>} order
 * @param {Step} s
 * @param {Date} now
 * @returns {Promise<number[]>}
 */
async function write(trx, order, s, now) {
  await updateOrder(trx, order.id, s.fields, now);
  for (const text of s.events) await insertEvent(trx, order.id, text, now);
  if (!s.message) return [];
  const payload = { text: s.message.text, ref: order.order_no };
  return insertNotifications(
    trx,
    order.id,
    [
      { channel: 'whatsapp', recipient: order.customer_phone, template: s.message.template, payload },
      { channel: 'email', recipient: order.customer_email, template: s.message.template, payload },
    ],
    now,
  );
}

/**
 * A staff step, audited with who took it.
 * @param {Deps} deps
 * @param {{ id: number }} staff
 * @param {string} ref
 * @param {string} action For the audit log.
 * @param {(order: Record<string, any>) => Step} decide
 * @param {Date} now
 * @param {Extra} [extra] More writes in the same transaction.
 */
export async function staffStep(deps, staff, ref, action, decide, now, extra) {
  const ids = await withTransaction(need(deps), async (trx) => {
    const order = await findByOrderNo(trx, ref.trim().toUpperCase(), { lock: true });
    if (!order) throw new OrderError('not_found', 'There is no order with that number.');
    const s = decide(order);
    const out = await write(trx, order, s, now);
    if (extra) await extra(trx, order);
    await audit(trx, staff.id, action, order.id, s.audit);
    return out;
  });
  await queueNotifications(deps, ids);
}

/**
 * A customer's step, with the order's access (link, phone or session) checked first.
 * @param {Deps} deps
 * @param {string} ref
 * @param {Access} access
 * @param {(order: Record<string, any>) => Step} decide
 * @param {Date} now
 */
export async function customerStep(deps, ref, access, decide, now) {
  const { order_no: orderNo } = await findOrderFor(deps, ref, access, now);
  const ids = await withTransaction(need(deps), async (trx) => {
    const order = /** @type {Record<string, any>} */ (await findByOrderNo(trx, orderNo, { lock: true }));
    return write(trx, order, decide(order), now);
  });
  await queueNotifications(deps, ids);
  return getOrder(deps, orderNo, access, now);
}
