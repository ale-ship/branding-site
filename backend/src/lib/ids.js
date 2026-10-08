// @ts-check
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Order numbers and secret tokens (docs/BACKEND_RUNBOOK.md, section 7). The order number is shown to
 * customers and typed as the Paybill reference; the token is the secret link, stored only as its hash.
 */

/** `NB-` and six digits. Unique only once the database accepts it: the caller retries on a clash. */
export const newOrderNo = () => `NB-${randomInt(100000, 1000000)}`;

/** 32 hex characters: the secret in the order's link. */
export const newToken = () => randomBytes(16).toString('hex');

/** @param {string} token */
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * Whether `token` is the one hashed as `hash`, in constant time.
 * @param {string} token
 * @param {string} hash
 */
export function tokenMatches(token, hash) {
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
