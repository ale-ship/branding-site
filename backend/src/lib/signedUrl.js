// @ts-check
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived links to private files (docs/BACKEND_RUNBOOK.md, section 9): `/api/files/<key>?exp=…&sig=…`,
 * an HMAC of the key and the expiry. The order page gets fresh links each time it reads the order.
 */

/**
 * @param {string} secret
 * @param {string} key
 * @param {number} exp Unix seconds.
 */
const signature = (secret, key, exp) => createHmac('sha256', secret).update(`${key}\n${exp}`).digest('hex');

/**
 * @param {string} secret
 * @param {string} key
 * @param {{ ttlSeconds?: number; now?: Date }} [o]
 * @returns {string} A path on our own origin.
 */
export function signedPath(secret, key, { ttlSeconds = 3600, now = new Date() } = {}) {
  // Rounded up to ten minutes, so the link (and the browser's cache of the image) stays the same a while.
  const exp = Math.ceil((now.getTime() / 1000 + ttlSeconds) / 600) * 600;
  return `/api/files/${key.split('/').map(encodeURIComponent).join('/')}?exp=${exp}&sig=${signature(secret, key, exp)}`;
}

/**
 * @param {string} secret
 * @param {string} key
 * @param {string} exp
 * @param {string} sig
 * @param {Date} [now]
 */
export function verifySignature(secret, key, exp, sig, now = new Date()) {
  const when = Number(exp);
  if (!Number.isInteger(when) || when < now.getTime() / 1000) return false;
  const expected = Buffer.from(signature(secret, key, when), 'hex');
  const given = Buffer.from(String(sig), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
