// @ts-check
import { randomInt } from 'node:crypto';
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import {
  CODE_LENGTH,
  CODE_MAX_TRIES,
  CODE_RESEND_SECONDS,
  CODE_TTL_MINUTES,
  isCode,
  maskEmail,
  normaliseEmail,
  SESSION_DAYS,
} from '@noorcom-branding/shared/rules/account.js';
import { AppError } from '../../lib/errors.js';
import { hashToken, newToken } from '../../lib/ids.js';
import * as repo from './repo.js';

/**
 * Signing customers in (docs/ORDER_WORKFLOW_SPEC.md, "Accounts"; owner, 8 Oct 2026): a six-digit code
 * emailed to them, never a password. Codes last ten minutes, allow five tries and can be resent
 * after a minute; only their hashes are stored, and the code is never returned or logged. The code
 * goes straight to the mailer rather than the outbox: it is no use once it expires, and it then
 * stays out of the database. A session is a random token, kept by the site in its httpOnly
 * `nb-session` cookie and sent to the API as `X-Account-Session`; it lasts thirty days.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 */

const WRONG = 'That code isn’t right, or it has expired. Ask for a new one.';
export const SIGN_IN_AGAIN = 'Please sign in again.';

/** @param {Deps} deps */
export function need(deps) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'Accounts are unavailable for a moment. Please try again shortly.');
  return deps.pool;
}

/** @param {unknown} raw */
export function emailOf(raw) {
  const email = normaliseEmail(raw);
  if (!email) throw new OrderError('invalid', 'Enter your email address, like you@company.co.ke.');
  return email;
}

/** The code is hashed with its email, so one hash can't be tried against another address. */
const codeHash = (/** @type {string} */ email, /** @type {string} */ code) => hashToken(`${email}:${code}`);

/**
 * Emails a new sign-in code.
 * @param {Deps} deps
 * @param {string} rawEmail
 * @param {Date} [now]
 * @returns {Promise<{ sentTo: string }>}
 */
export async function requestCode(deps, rawEmail, now = new Date()) {
  const pool = need(deps);
  const email = emailOf(rawEmail);
  if (!deps.mailer) throw new AppError(503, 'unavailable', 'We can’t send email just now. Please try again shortly.');
  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
  const stored = await repo.putCode(pool, {
    email,
    codeHash: codeHash(email, code),
    now,
    expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000),
    resendSec: CODE_RESEND_SECONDS,
  });
  if (!stored) {
    const sentAt = (await repo.codeSentAt(pool, email)) ?? now;
    const wait = Math.max(1, Math.ceil((sentAt.getTime() + CODE_RESEND_SECONDS * 1000 - now.getTime()) / 1000));
    throw new OrderError('invalid', `We’ve just sent a code. You can ask for another in ${wait} seconds.`);
  }
  try {
    await deps.mailer.send({
      to: email,
      subject: `${code} is your Noorcom Branding sign-in code`,
      text: `Your sign-in code is ${code}. It lasts ${CODE_TTL_MINUTES} minutes.\n\nIf you didn’t ask to sign in, you can ignore this email: nobody can sign in without the code.\n\nNoorcom Branding`,
    });
  } catch (err) {
    // Let them ask again at once rather than wait out a code they never got.
    await repo.deleteCode(pool, email);
    deps.logger?.warn({ err }, 'sign-in code not sent');
    throw new AppError(503, 'unavailable', 'We couldn’t send the code just now. Please try again in a moment.');
  }
  deps.logger?.info({ to: maskEmail(email) }, 'sign-in code sent');
  return { sentTo: maskEmail(email) };
}

/**
 * Checks a code and opens a session. One message for every failure.
 * @param {Deps} deps
 * @param {string} rawEmail
 * @param {string} rawCode
 * @param {Date} [now]
 * @returns {Promise<{ session: string }>}
 */
export async function verifyCode(deps, rawEmail, rawCode, now = new Date()) {
  const pool = need(deps);
  const email = emailOf(rawEmail);
  const code = String(rawCode ?? '').trim();
  const stored = await repo.tryCode(pool, email, now, CODE_MAX_TRIES);
  if (!stored || !isCode(code) || stored !== codeHash(email, code)) throw new OrderError('invalid', WRONG);
  if (!(await repo.claimCode(pool, email, stored))) throw new OrderError('invalid', WRONG);
  const session = newToken() + newToken();
  await repo.insertSession(pool, { tokenHash: hashToken(session), email, now, expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000) });
  await repo.profileOf(pool, email);
  return { session };
}

/**
 * The email a session signs in as; not_found once it has expired or been signed out.
 * @param {Deps} deps
 * @param {string} session
 * @param {Date} [now]
 * @returns {Promise<string>}
 */
export async function emailFromSession(deps, session, now = new Date()) {
  const pool = need(deps);
  const email = session ? await repo.sessionEmail(pool, hashToken(session), now) : null;
  if (!email) throw new OrderError('not_found', SIGN_IN_AGAIN);
  return email;
}

/**
 * @param {Deps} deps
 * @param {string} session
 */
export async function signOut(deps, session) {
  if (session) await repo.deleteSession(need(deps), hashToken(session));
}
