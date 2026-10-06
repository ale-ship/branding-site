// @ts-check
import 'dotenv/config';
import { z } from 'zod';

/**
 * The ONLY place `process.env` is read (docs/BACKEND_RUNBOOK.md, section 4). Validated at start-up:
 * a bad value stops the server with a message naming it, instead of failing later on a request.
 */

const mode = z.enum(['fake', 'live']).default('fake');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Loopback only: nginx is the sole public entrance (section 10).
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4300),
  SITE_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  REDIS_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional().or(z.literal('').transform(() => undefined)),
  BUILD_ID: z.string().default(''),
  ABSA_MODE: mode,
  DARAJA_MODE: mode,
  WHATSAPP_MODE: mode,
  STORAGE_MODE: mode,
});

/**
 * @typedef {object} Config
 * @property {'development' | 'test' | 'production'} env
 * @property {string} host
 * @property {number} port
 * @property {string} siteOrigin
 * @property {string | undefined} databaseUrl
 * @property {string | undefined} redisUrl
 * @property {string | undefined} logLevel
 * @property {string} build
 * @property {{ absa: 'fake' | 'live'; daraja: 'fake' | 'live'; whatsapp: 'fake' | 'live'; storage: 'fake' | 'live' }} integrations
 */

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Config}
 */
export function parseConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${problems}`);
  }
  const c = parsed.data;
  if (c.NODE_ENV === 'production') {
    const missing = /** @type {const} */ (['DATABASE_URL', 'REDIS_URL']).filter((k) => !c[k]);
    if (missing.length) throw new Error(`Invalid configuration: ${missing.map((k) => `${k}: required in production`).join('; ')}`);
  }
  return {
    env: c.NODE_ENV,
    host: c.HOST,
    port: c.PORT,
    siteOrigin: c.SITE_ORIGIN,
    databaseUrl: c.DATABASE_URL,
    redisUrl: c.REDIS_URL,
    logLevel: c.LOG_LEVEL,
    build: c.BUILD_ID,
    integrations: { absa: c.ABSA_MODE, daraja: c.DARAJA_MODE, whatsapp: c.WHATSAPP_MODE, storage: c.STORAGE_MODE },
  };
}
