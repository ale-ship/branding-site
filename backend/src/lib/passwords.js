// @ts-check
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Staff password hashes: scrypt from node:crypto (OWASP's settings: N=2^17, r=8, p=1), stored as
 * `scrypt$N$r$p$salt$hash`. Chosen over the argon2 package (owner's runbook, section 2) because it
 * needs no native build on the VPS or on Windows, where npm now holds back install scripts.
 */

const N = 2 ** 17;
const R = 8;
const P = 1;
const KEYLEN = 32;
// scrypt needs 128 · N · r bytes; allow that plus headroom.
const MAXMEM = 256 * N * R;

/**
 * @param {string} password
 * @param {Buffer} salt
 * @param {{ n: number; r: number; p: number }} cost
 * @returns {Promise<Buffer>}
 */
const derive = (password, salt, { n, r, p }) =>
  new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))),
  );

/**
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { n: N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('hex'), key.toString('hex')].join('$');
}

/**
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const key = await derive(password, Buffer.from(salt, 'hex'), { n: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** At least 12 characters; length beats rules. */
export const PASSWORD_MIN = 12;
