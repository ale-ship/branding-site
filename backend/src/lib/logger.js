// @ts-check
import pino from 'pino';

/**
 * Logs are JSON lines (pino). Personal data never goes in them (docs/BACKEND_RUNBOOK.md, section 9):
 * Kenyan phone numbers are masked wherever they appear, to their first four and last three digits,
 * and secrets, tokens and cookies are redacted by name.
 */

const PHONE = /(?<!\d)(?:\+?254|0)[17]\d{8}(?!\d)/g;

/**
 * `+254722530301` -> `+2547*****301`.
 * @param {string} digits
 * @returns {string}
 */
export function maskPhone(digits) {
  const plus = digits.startsWith('+') ? '+' : '';
  const bare = digits.replace('+', '');
  return `${plus}${bare.slice(0, 4)}${'*'.repeat(Math.max(bare.length - 7, 0))}${bare.slice(-3)}`;
}

/** @param {string} text */
export const maskPhones = (text) => text.replace(PHONE, maskPhone);

/**
 * Masks phone numbers in every string inside a value (objects and arrays, a few levels deep).
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
export function maskDeep(value, depth = 0) {
  if (typeof value === 'string') return maskPhones(value);
  // Errors are masked by the `err` serializer after this pass; walking them here would empty them.
  if (depth > 6 || value === null || typeof value !== 'object' || value instanceof Error) return value;
  if (Array.isArray(value)) return value.map((v) => maskDeep(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskDeep(v, depth + 1)]));
}

/** @typedef {import('pino').Logger} Logger */

/**
 * @param {{ env?: string; level?: string; stream?: import('pino').DestinationStream }} [options]
 * @returns {Logger}
 */
export function createLogger({ env = 'development', level, stream } = {}) {
  return pino(
    {
      level: level || (env === 'test' ? 'silent' : env === 'production' ? 'info' : 'debug'),
      base: { app: 'noorcom-branding-api' },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'headers.authorization', 'headers.cookie', '*.password', '*.token', '*.secret', '*.code', '*.session'],
        censor: '[redacted]',
      },
      serializers: { err: (e) => /** @type {Record<string, unknown>} */ (maskDeep(pino.stdSerializers.err(e))) },
      formatters: { log: (obj) => /** @type {Record<string, unknown>} */ (maskDeep(obj)) },
      hooks: {
        logMethod(args, method) {
          const a = /** @type {unknown[]} */ (args);
          if (typeof a[0] === 'string') a[0] = maskPhones(a[0]);
          else if (typeof a[1] === 'string') a[1] = maskPhones(a[1]);
          method.apply(this, /** @type {Parameters<typeof method>} */ (args));
        },
      },
    },
    stream,
  );
}
