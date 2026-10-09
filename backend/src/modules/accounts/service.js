// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { coerceAddress, coerceBrandKit, MAX_ADDRESSES } from '@noorcom-branding/shared/rules/account.js';
import { normaliseKenyanPhone } from '@noorcom-branding/shared/rules/phone.js';
import { randomInt } from 'node:crypto';
import { statementFrom } from '../reports/accounts.service.js';
import { statementOf } from '../reports/repo.js';
import * as companies from './company.repo.js';
import * as repo from './repo.js';
import { emailFromSession, need } from './session.service.js';

/**
 * A signed-in customer's account (docs/ORDER_WORKFLOW_SPEC.md, "Accounts"), as the site's mock does it
 * (src/lib/api/mock-accounts.ts): every order placed with the email, guest orders included; the
 * details, brand kit and addresses kept between orders; reorders; the statement; and the company.
 * Everything takes the session; the email always comes from it, never from the request.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').Account} Account
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderSummary} OrderSummary
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').ReorderDraft} ReorderDraft
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').SavedAddress} SavedAddress
 * @typedef {Record<string, any>} Row
 */

/** A finished, approved design that can be printed again without redesign. */
const canReorder = (/** @type {Row} */ o) => o.mechanism === 'A' && !!o.approved && !['expired', 'cancelled'].includes(o.status);

/**
 * @param {Row} o
 * @returns {OrderSummary}
 */
const summary = (o) => ({
  ref: o.order_no,
  createdAt: new Date(o.created_at).toISOString(),
  status: o.status,
  productName: o.product.name,
  productSlug: o.product.slug,
  mechanism: o.mechanism,
  quantity: o.quantity,
  total: o.total,
  amountPaid: o.amount_paid,
  invoiceNo: o.invoice_no,
  canReorder: canReorder(o),
});

/**
 * @param {Deps} deps
 * @param {string} email
 * @returns {Promise<Account>}
 */
export async function accountOf(deps, email) {
  const pool = need(deps);
  const [p, mine, company] = await Promise.all([repo.profileOf(pool, email), repo.ordersOf(pool, email), companies.companyOf(pool, email)]);
  const others = company && company.role !== 'member' ? await repo.companyOrders(pool, company.id, email) : [];
  // Details not filled in yet come from the latest order.
  const latest = mine[0];
  return {
    email,
    name: p.name || latest?.customer_name || '',
    phone: p.phone || latest?.customer_phone || '',
    company: p.company || latest?.customer_company || '',
    brandKit: p.brand_kit ?? null,
    addresses: p.addresses ?? [],
    orders: mine.map(summary),
    credit: mine.reduce((s, o) => s + o.credit, 0),
    companyAccount: company,
    companyOrders: others.map((o) => ({ ...summary(o), placedBy: o.customer_name })),
  };
}

/**
 * The account, or not_found once the session has run out (the site then shows sign-in).
 * @param {Deps} deps
 * @param {string} session
 */
export async function getAccount(deps, session) {
  return accountOf(deps, await emailFromSession(deps, session));
}

/**
 * @param {Deps} deps
 * @param {string} session
 * @param {{ name: string; phone: string; company: string }} details
 */
export async function updateDetails(deps, session, details) {
  const email = await emailFromSession(deps, session);
  if (details.name.trim().length < 2) throw new OrderError('invalid', 'Enter your name.');
  const phone = details.phone.trim() ? normaliseKenyanPhone(details.phone) : '';
  if (phone === null) throw new OrderError('invalid', 'Check your phone number, like 0722 530 301.');
  await repo.profileOf(need(deps), email);
  await repo.updateProfile(need(deps), email, { name: details.name.trim().slice(0, 100), phone, company: details.company.trim().slice(0, 120) });
  return accountOf(deps, email);
}

/**
 * @param {Deps} deps
 * @param {string} session
 * @param {unknown} raw
 */
export async function saveBrandKit(deps, session, raw) {
  const email = await emailFromSession(deps, session);
  const { kit, errors } = coerceBrandKit(raw);
  const problem = Object.values(errors)[0];
  if (problem) throw new OrderError('invalid', problem);
  await repo.profileOf(need(deps), email);
  await repo.updateProfile(need(deps), email, { brandKit: kit });
  return accountOf(deps, email);
}

/**
 * Adds an address, or changes the one with the same id.
 * @param {Deps} deps
 * @param {string} session
 * @param {unknown} raw
 */
export async function saveAddress(deps, session, raw) {
  const email = await emailFromSession(deps, session);
  const { address, error } = coerceAddress(raw);
  if (error) throw new OrderError('invalid', error);
  const p = await repo.profileOf(need(deps), email);
  /** @type {SavedAddress[]} */
  const addresses = p.addresses ?? [];
  const existing = address.id ? addresses.find((a) => a.id === address.id) : undefined;
  if (existing) Object.assign(existing, { label: address.label, address: address.address, zone: address.zone });
  else {
    if (addresses.length >= MAX_ADDRESSES) throw new OrderError('invalid', `Up to ${MAX_ADDRESSES} addresses; remove one first.`);
    addresses.push({ id: `ADR-${randomInt(100000, 1000000)}`, label: address.label, address: address.address, zone: address.zone });
  }
  await repo.updateProfile(need(deps), email, { addresses });
  return accountOf(deps, email);
}

/**
 * @param {Deps} deps
 * @param {string} session
 * @param {string} id
 */
export async function removeAddress(deps, session, id) {
  const email = await emailFromSession(deps, session);
  const p = await repo.profileOf(need(deps), email);
  await repo.updateProfile(need(deps), email, { addresses: (p.addresses ?? []).filter((/** @type {SavedAddress} */ a) => a.id !== id) });
  return accountOf(deps, email);
}

/**
 * A past order's choices with its approved artwork, to place again without the design step.
 * @param {Deps} deps
 * @param {string} session
 * @param {string} ref
 * @returns {Promise<ReorderDraft>}
 */
export async function reorderDraft(deps, session, ref) {
  const email = await emailFromSession(deps, session);
  const order = await repo.ownOrder(need(deps), email, ref.trim().toUpperCase());
  if (!order) throw new OrderError('not_found', 'We couldn’t find that order in your account.');
  if (!canReorder({ ...order, approved: order.approved_version != null })) {
    throw new OrderError('invalid_state', 'Only printed orders with an approved design can be reordered.');
  }
  const notes = order.common.notes ? ` ${order.common.notes}` : '';
  return {
    from: order.order_no,
    product: order.product.slug,
    quantity: order.quantity,
    brief: order.brief,
    urgency: 'standard',
    handover: order.handover,
    common: {
      ...order.common,
      artwork: 'print-ready',
      notes: `Reorder of ${order.order_no}: print the approved proof v${order.approved_version} again.${notes}`.slice(0, 1000),
    },
  };
}

/**
 * Invoices and payments on the account's own orders, with a running balance.
 * @param {Deps} deps
 * @param {string} session
 */
export async function getStatement(deps, session) {
  const email = await emailFromSession(deps, session);
  const { orders, payments } = await statementOf(need(deps), email);
  return statementFrom(orders, payments);
}
