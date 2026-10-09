// @ts-check
import { randomInt } from 'node:crypto';
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { withTransaction } from '../../db/pool.js';
import * as companies from './company.repo.js';
import { accountOf } from './service.js';
import { emailFromSession, emailOf, need } from './session.service.js';

/**
 * Company accounts (docs/ORDER_WORKFLOW_SPEC.md, "Accounts": several people ordering for one company,
 * an owner or approver approving their proofs, the PO number on the invoice). One company per email.
 * Only the owner changes who is in it, and the owner can't be removed.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('./company.repo.js').Member} Member
 */

const MAX_MEMBERS = 50;

/**
 * @param {Deps} deps
 * @param {string} session
 * @param {{ name: string; kraPin: string }} details
 */
export async function createCompany(deps, session, details) {
  const email = await emailFromSession(deps, session);
  const pool = need(deps);
  const name = details.name.trim().slice(0, 120);
  const kraPin = details.kraPin.trim().toUpperCase().slice(0, 20);
  if (name.length < 2) throw new OrderError('invalid', 'Enter the company name.');
  if (kraPin && !/^[A-Z]\d{9}[A-Z]$/.test(kraPin)) throw new OrderError('invalid', 'A KRA PIN looks like P051234567X.');
  const owner = (await accountOf(deps, email)).name || 'Owner';
  await withTransaction(pool, async (trx) => {
    if (await companies.companyOf(trx, email)) throw new OrderError('invalid_state', 'Your email already belongs to a company.');
    let id = '';
    for (let tries = 0; !id && tries < 10; tries++) {
      const draw = `CO-${randomInt(100000, 1000000)}`;
      if (await companies.insertCompany(trx, { id: draw, name, kraPin })) id = draw;
    }
    if (!id) throw new Error('no free company id after 10 draws');
    if (!(await companies.insertMember(trx, id, { email, name: owner, role: 'owner' }))) {
      throw new OrderError('invalid_state', 'Your email already belongs to a company.');
    }
  });
  return accountOf(deps, email);
}

/**
 * The company the signed-in owner runs, locked for the change.
 * @param {import('../../db/pool.js').Client} trx
 * @param {string} email
 */
async function ownCompany(trx, email) {
  const c = await companies.companyOf(trx, email, { lock: true });
  if (!c || c.role !== 'owner') throw new OrderError('invalid_state', 'Only the company’s owner can change its members.');
  return c;
}

/**
 * @param {Deps} deps
 * @param {string} session
 * @param {{ email: string; name: string; role: string }} member
 */
export async function addMember(deps, session, member) {
  const email = await emailFromSession(deps, session);
  const memberEmail = emailOf(member.email);
  const name = member.name.trim().slice(0, 100);
  if (name.length < 2) throw new OrderError('invalid', 'Enter their name.');
  await withTransaction(need(deps), async (trx) => {
    const company = await ownCompany(trx, email);
    if (company.members.length >= MAX_MEMBERS) throw new OrderError('invalid', `Up to ${MAX_MEMBERS} people per company.`);
    const added = await companies.insertMember(trx, company.id, { email: memberEmail, name, role: member.role === 'approver' ? 'approver' : 'member' });
    if (!added) throw new OrderError('invalid', 'That email already belongs to a company.');
  });
  return accountOf(deps, email);
}

/**
 * @param {Deps} deps
 * @param {string} session
 * @param {string} rawEmail
 */
export async function removeMember(deps, session, rawEmail) {
  const email = await emailFromSession(deps, session);
  const removed = emailOf(rawEmail);
  if (removed === email) throw new OrderError('invalid', 'The owner can’t be removed.');
  await withTransaction(need(deps), async (trx) => {
    const company = await ownCompany(trx, email);
    await companies.deleteMember(trx, company.id, removed);
  });
  return accountOf(deps, email);
}

/**
 * For a new order: the company it is placed for. Only a signed-in member ordering with their own
 * email can place one; anything else is refused rather than quietly ignored.
 * @param {Deps} deps
 * @param {string} session
 * @param {string} customerEmail Already normalised.
 * @returns {Promise<{ id: string; name: string }>}
 */
export async function companyForOrder(deps, session, customerEmail) {
  const email = session ? await emailFromSession(deps, session).catch(() => null) : null;
  const company = email === customerEmail ? await companies.companyOf(need(deps), customerEmail) : null;
  if (!company) throw new OrderError('invalid', 'Sign in with your company email to order for your company.');
  return { id: company.id, name: company.name };
}

/**
 * Whether the email may open the company's orders and approve its proofs (owners and approvers).
 * @param {Deps} deps
 * @param {string} companyId
 * @param {string} email
 */
export const approvesFor = (deps, companyId, email) => companies.approves(need(deps), companyId, email);

/**
 * The company's name and who approves its proofs, for an order's page.
 * @param {Deps} deps
 * @param {string} companyId
 */
export const approvalOf = (deps, companyId) => companies.approvalOf(need(deps), companyId);
