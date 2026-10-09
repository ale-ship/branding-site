// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { normaliseEmail } from '@noorcom-branding/shared/rules/account.js';
import { addWorkingDays, nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { allocate, machineFor, MACHINES } from '@noorcom-branding/shared/rules/capacity.js';
import { normaliseKenyanPhone } from '@noorcom-branding/shared/rules/phone.js';
import { estimatePrice, UNPAID_EXPIRY_HOURS } from '@noorcom-branding/shared/rules/pricing.js';
import { needsSample } from '@noorcom-branding/shared/rules/production.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { hashToken, newOrderNo, newToken, tokenMatches } from '../../lib/ids.js';
import { nextNumber } from '../../lib/numbering.js';
import { signedPath } from '../../lib/signedUrl.js';
import { approvalOf, approvesFor, companyForOrder } from '../accounts/company.service.js';
import { emailFromSession } from '../accounts/session.service.js';
import { book, bookedFrom, lockCalendar, release } from '../capacity/repo.js';
import { getProduct } from '../catalogue/service.js';
import { queueNotifications } from '../notifications/service.js';
import { orderPlaced } from '../notifications/templates.js';
import { checkOrderInput } from './checks.js';
import * as repo from './repo.js';
import { toOrder } from './view.js';

/**
 * Orders (docs/BACKEND_RUNBOOK.md, step B2): placed, read by the customer, expired when unpaid.
 *
 * Placing an order is one transaction: the price worked out again against the capacity calendar
 * (under a lock, so two orders can't take the same machine time), the order row, its machine time,
 * its invoice number, the "Order placed" event and the WhatsApp and email messages in the outbox.
 * Nothing leaves the building inside it: the worker sends the outbox after commit.
 *
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').Order} Order
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderInput} OrderInput
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderProduct} OrderProduct
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderProgress} OrderProgress
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../../middleware/customerAccess.js').Access} Access
 */

const NOT_FOUND = 'We couldn’t find that order.';

/**
 * Signs links to stored files (proofs) for an hour.
 * @param {Deps} deps
 * @returns {(key: string) => string}
 */
export const signerFor = (deps) => (key) => signedPath(deps.config?.files.secret ?? 'dev-files-secret', key);

/** @param {import('pg').Pool | null} pool */
function need(pool) {
  if (!pool) throw new AppError(503, 'unavailable', 'Ordering is unavailable for a moment. Please try again shortly.');
  return pool;
}

/**
 * @param {OrderProduct} p
 * @param {number} quantity
 * @returns {OrderProgress}
 */
function initialProgress(p, quantity) {
  if (p.mechanism === 'A') return { kind: 'pieces', done: 0, total: quantity };
  if (p.mechanism === 'B') return { kind: 'stages', done: 0, total: p.stages.length, stages: p.stages.map((name) => ({ name, done: false })) };
  return { kind: 'rounds', done: 0, total: p.revisionRounds };
}

/**
 * Prices the order again (the browser's price is never used) and opens it, awaiting payment.
 * @param {Deps} deps
 * @param {OrderInput} input Already shaped by `orderInputSchema`.
 * @param {Date} [now]
 * @param {{ session?: string }} [signedIn] The account's session: a company order needs a member's.
 * @returns {Promise<{ ref: string; token: string }>}
 */
export async function createOrder(deps, input, now = new Date(), { session = '' } = {}) {
  const pool = need(deps.pool);
  const product = await getProduct(deps, input.product);
  if (!product) throw new OrderError('invalid', 'That item can’t be ordered online.');
  checkOrderInput(product, input);
  const phone = normaliseKenyanPhone(input.customer.phone);
  if (!phone) throw new OrderError('invalid', 'Enter a Kenyan mobile number, like 0722 530 301.');
  const email = normaliseEmail(input.customer.email);
  if (!email) throw new OrderError('invalid', 'Enter a valid email address.');
  // A company order only for a signed-in member ordering with their own email.
  const company = input.company ? { id: (await companyForOrder(deps, session, email)).id, po: input.company.poNumber.trim().slice(0, 40) } : null;

  const quantity = product.mechanism === 'A' ? input.quantity : 1;
  const today = nairobiToday(now);
  const token = newToken();

  const placed = await withTransaction(pool, async (trx) => {
    await lockCalendar(trx);
    const calendar = await bookedFrom(trx, today);
    const estimate = estimatePrice(product, { ...input, quantity }, today, calendar);
    if (product.mechanism !== 'B' && estimate.urgency.code !== input.urgency) {
      throw new OrderError('invalid', 'That deadline isn’t available for this order any more: choose another.');
    }
    // The order holds its machine time until it is paid or expires.
    const machine = machineFor(product, input.brief);
    const order = {
      tokenHash: hashToken(token),
      mechanism: product.mechanism,
      product: { slug: product.slug, name: product.name, category: product.category },
      quantity,
      brief: input.brief,
      common: input.common,
      needsDesign: product.mechanism === 'C' || input.needsDesign,
      urgency: estimate.urgency.code,
      handover: input.handover,
      customer: { name: input.customer.name, company: input.customer.company, phone, email },
      company,
      estimate,
      total: estimate.total,
      dueNow: estimate.dueNow.amount,
      duePurpose: estimate.dueNow.purpose,
      progress: initialProgress(product, quantity),
      survey: product.mechanism === 'B' ? { preferred: /** @type {string[]} */ (input.brief.surveyDates ?? []), booked: null } : null,
      sample: needsSample(product.mechanism, quantity) ? { status: 'waiting', photo: null, uploadedAt: null, comments: null } : null,
      dailyCapacity: machine ? MACHINES[machine].dailyUnits : null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + UNPAID_EXPIRY_HOURS * 3_600_000),
    };

    // Six random digits: draw again on the rare clash.
    let id = null;
    let ref = '';
    for (let tries = 0; id === null && tries < 10; tries++) {
      ref = newOrderNo();
      id = await repo.insertOrder(trx, { ...order, orderNo: ref });
    }
    if (id === null) throw new Error('no free order number after 10 draws');

    if (machine) await book(trx, id, machine, allocate(quantity, machine, addWorkingDays(today, 1), calendar).days);
    await repo.insertInvoice(trx, id, { invoiceNo: await nextNumber(trx, 'invoice'), lines: estimate.lines, subtotal: estimate.subtotal, total: estimate.total });
    await repo.insertEvent(trx, id, 'Order placed.', now);
    const text = orderPlaced({ name: order.customer.name, ref, dueNow: order.dueNow });
    const notificationIds = await repo.insertNotifications(
      trx,
      id,
      [
        { channel: 'whatsapp', recipient: phone, template: 'order-placed', payload: { text, ref } },
        { channel: 'email', recipient: email, template: 'order-placed', payload: { text, ref } },
      ],
      now,
    );
    return { ref, token, notificationIds };
  });
  deps.logger?.info({ ref: placed.ref, product: product.slug }, 'order placed');
  // After commit: the worker sends the messages (the outbox sweep catches any this misses).
  await queueNotifications(deps, placed.notificationIds);
  return { ref: placed.ref, token: placed.token };
}

/**
 * Expires unpaid orders past their 48 hours (just one when `orderId` is given) and lets go of their
 * machine time. Run on every read of an unpaid order and every 15 minutes by the worker.
 * @param {{ pool: import('pg').Pool | null }} deps
 * @param {Date} [now]
 * @param {number} [orderId]
 * @returns {Promise<number>} How many expired.
 */
export async function expireUnpaid(deps, now = new Date(), orderId) {
  return withTransaction(need(deps.pool), async (trx) => {
    const ids = await repo.expireUnpaid(trx, now, orderId);
    await release(trx, ids);
    for (const id of ids) await repo.insertEvent(trx, id, `Not paid within ${UNPAID_EXPIRY_HOURS} hours, so the order has expired.`, now);
    return ids.length;
  });
}

/**
 * Whether the access opens the order: the link's token, the phone it was placed with, or a session
 * for the email it was placed with or for an owner or approver of the company it was placed for.
 * @param {Deps} deps
 * @param {Record<string, any>} row
 * @param {Access} access
 */
async function opens(deps, row, access) {
  if ('token' in access) return !!access.token && tokenMatches(access.token, row.token_hash);
  if ('phone' in access) return normaliseKenyanPhone(access.phone) === row.customer_phone;
  const email = await emailFromSession(deps, access.session).catch(() => null);
  if (!email) return false;
  return email === row.customer_email || (!!row.company_id && (await approvesFor(deps, row.company_id, email)));
}

/**
 * The order for its customer: by the secret link's token, or by the phone it was placed with (order
 * number + phone). The same not_found either way, so neither can be used to find which orders exist.
 * @param {Deps} deps
 * @param {string} ref
 * @param {Access} access
 * @param {Date} [now]
 * @returns {Promise<Record<string, any>>} The order row, expired first if its time is up.
 */
export async function findOrderFor(deps, ref, access, now = new Date()) {
  const pool = need(deps.pool);
  const orderNo = ref.trim().toUpperCase();
  let row = await repo.findByOrderNo(pool, orderNo);
  if (!row || !(await opens(deps, row, access))) throw new OrderError('not_found', NOT_FOUND);
  if (row.status === 'awaiting_payment' && row.expires_at && new Date(row.expires_at) < now) {
    await expireUnpaid(deps, now, row.id);
    row = await repo.findByOrderNo(pool, orderNo);
    if (!row) throw new OrderError('not_found', NOT_FOUND);
  }
  return row;
}

/**
 * The order as the customer sees it (`Order`): see `findOrderFor` for the access.
 * @param {Deps} deps
 * @param {string} ref
 * @param {Access} access
 * @param {Date} [now]
 * @returns {Promise<Order>}
 */
export async function getOrder(deps, ref, access, now = new Date()) {
  const row = await findOrderFor(deps, ref, access, now);
  const company = row.company_id ? await approvalOf(deps, row.company_id) : null;
  return toOrder(row, await repo.historyOf(need(deps.pool), row.id), signerFor(deps), company);
}
