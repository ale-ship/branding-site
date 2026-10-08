// @ts-check
import { normaliseEmail } from '@noorcom-branding/shared/rules/account.js';
import { AppError } from '../../lib/errors.js';
import { hashToken, newToken } from '../../lib/ids.js';
import { hashPassword, PASSWORD_MIN, verifyPassword } from '../../lib/passwords.js';
import * as repo from './repo.js';

/**
 * Staff accounts and sign-in (docs/ORDER_WORKFLOW_SPEC.md, "Staff dashboard": roles). Email and
 * password; the session token lives in an httpOnly cookie and only its hash in Postgres. Sessions
 * last 14 days from the last use. The first admin is made from the command line
 * (`npm run staff:add` in backend/); after that, admins add staff in the back office.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('./repo.js').Staff} Staff
 * @typedef {'admin' | 'sales' | 'designer' | 'production' | 'installer'} Role
 */

export const ROLES = /** @type {const} */ (['admin', 'sales', 'designer', 'production', 'installer']);
export const SESSION_DAYS = 14;
const WRONG = 'That email and password don’t match an active staff account.';

/** A hash to check against when the email is unknown, so both cases take the same time. */
let dummyHash = '';

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'The back office is unavailable for a moment.');
  return deps.pool;
}

/** @param {Date} now */
const expiry = (now) => new Date(now.getTime() + SESSION_DAYS * 86_400_000);

/**
 * @param {Deps} deps
 * @param {string} email
 * @param {string} password
 * @param {Date} [now]
 * @returns {Promise<{ token: string; staff: Staff }>}
 */
export async function signIn(deps, email, password, now = new Date()) {
  const pool = need(deps);
  const user = await repo.findByEmail(pool, normaliseEmail(email) ?? '');
  dummyHash ||= await hashPassword('not-a-real-password');
  const ok = await verifyPassword(password, user?.password_hash ?? dummyHash);
  if (!user || !ok || !user.active) throw new AppError(401, 'unauthorised', WRONG);
  const token = newToken();
  await repo.insertSession(pool, hashToken(token), user.id, expiry(now));
  await repo.audit(pool, user.id, 'sign-in', null);
  const { password_hash: _hash, ...staff } = user;
  return { token, staff };
}

/**
 * @param {Deps} deps
 * @param {string} token
 * @param {Date} [now]
 * @returns {Promise<Staff | null>}
 */
export async function staffFromToken(deps, token, now = new Date()) {
  if (!token || !deps.pool) return null;
  return repo.useSession(deps.pool, hashToken(token), now, expiry(now));
}

/**
 * @param {Deps} deps
 * @param {string} token
 */
export async function signOut(deps, token) {
  if (token) await repo.deleteSession(need(deps), hashToken(token));
}

/**
 * @param {string} password
 */
function checkPassword(password) {
  if (password.length < PASSWORD_MIN) throw new AppError(400, 'invalid', `Passwords need at least ${PASSWORD_MIN} characters.`);
}

/**
 * Adds a staff member. `actor` is the admin doing it, or null from the command line.
 * @param {Deps} deps
 * @param {Staff | null} actor
 * @param {{ email: string; name: string; role: Role; password: string }} s
 * @returns {Promise<Staff>}
 */
export async function addStaff(deps, actor, { email, name, role, password }) {
  const pool = need(deps);
  const clean = normaliseEmail(email);
  if (!clean) throw new AppError(400, 'invalid', 'Enter a valid email address.');
  if (!name.trim()) throw new AppError(400, 'invalid', 'Enter their name.');
  checkPassword(password);
  const staff = await repo.insertStaff(pool, { email: clean, name: name.trim(), role, passwordHash: await hashPassword(password) });
  if (!staff) throw new AppError(409, 'invalid_state', 'There is already a staff account with that email.');
  await repo.audit(pool, actor?.id ?? null, 'staff-added', null, { staff: staff.id, role });
  return staff;
}

/**
 * @param {Deps} deps
 */
export async function listStaff(deps) {
  return repo.listStaff(need(deps));
}

/**
 * Changes a staff member's name, role, active flag or password. A password change or deactivation
 * signs them out everywhere; the last active admin can't be demoted or deactivated.
 * @param {Deps} deps
 * @param {Staff} actor
 * @param {number} id
 * @param {{ name?: string; role?: Role; active?: boolean; password?: string }} change
 * @returns {Promise<Staff>}
 */
export async function updateStaff(deps, actor, id, change) {
  const pool = need(deps);
  if (change.password !== undefined) checkPassword(change.password);
  const before = (await repo.listStaff(pool)).find((s) => s.id === id);
  if (!before) throw new AppError(404, 'not_found', 'No such staff member.');
  const losesAdmin = before.role === 'admin' && before.active && ((change.role && change.role !== 'admin') || change.active === false);
  if (losesAdmin && (await repo.countActiveAdmins(pool)) <= 1) {
    throw new AppError(409, 'invalid_state', 'There must always be one active admin.');
  }
  const passwordHash = change.password !== undefined ? await hashPassword(change.password) : undefined;
  const after = /** @type {Staff} */ (await repo.updateStaff(pool, id, { name: change.name?.trim() || undefined, role: change.role, active: change.active, passwordHash }));
  if (passwordHash || change.active === false) await repo.deleteSessionsOf(pool, id);
  await repo.audit(pool, actor.id, 'staff-changed', null, { staff: id, role: change.role, active: change.active, password: passwordHash ? 'reset' : undefined });
  return after;
}
