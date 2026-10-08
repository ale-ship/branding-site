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
  // Where the API is reached from outside: provider callbacks and links in messages.
  PUBLIC_URL: z.string().url().default('http://127.0.0.1:4300'),
  // The unguessable path segment on Absa's callback URLs (section 9).
  ABSA_CALLBACK_SECRET: z.string().default(''),
  ABSA_PAYBILL: z.string().regex(/^\d{5,7}$/).default('303030'),
  // Fake mode only: how long the fake Absa takes to answer a prompt.
  FAKE_STK_DELAY_MS: z.coerce.number().int().min(0).max(120_000).default(6000),
  MAIL_FROM: z.string().min(3).default('Noorcom Branding <info@noorcombranding.co.ke>'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_OUTBOX_DIR: z.string().min(1).default('.mail-outbox'),
  WHATSAPP_OUTBOX_DIR: z.string().min(1).default('.whatsapp-outbox'),
});

/** The live site: fakes must never answer for it (section 2.3, rule 2). */
const LIVE_HOSTS = ['noorcombranding.co.ke', 'www.noorcombranding.co.ke'];

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
 * @property {{ absa: 'fake' | 'live'; daraja: 'fake' | 'live'; whatsapp: 'fake' | 'live'; storage: 'fake' | 'live'; email: 'fake' | 'live' }} integrations
 * @property {string} publicUrl
 * @property {{ secret: string; paybill: string; fakeDelayMs: number }} absa
 * @property {{ from: string; outboxDir: string; smtp: { host: string; port: number; user: string; pass: string } | null }} mail
 * @property {{ outboxDir: string }} whatsapp
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
    if (c.ABSA_CALLBACK_SECRET.length < 24) throw new Error('Invalid configuration: ABSA_CALLBACK_SECRET: at least 24 characters in production');
  }
  // Clients that aren't built yet can't be switched on (section 2.3, rule 3).
  for (const [k, why] of /** @type {const} */ ([
    ['ABSA_MODE', 'Absa’s API documentation (section 14)'],
    ['DARAJA_MODE', 'the Daraja client (the fallback, not built)'],
    ['WHATSAPP_MODE', 'Meta’s approved templates'],
    ['STORAGE_MODE', 'the R2 client (uploads, step B5)'],
  ])) {
    if (c[k] === 'live') throw new Error(`Invalid configuration: ${k}: live is not built yet; it needs ${why}`);
  }
  const fake = [c.ABSA_MODE, c.DARAJA_MODE, c.WHATSAPP_MODE].includes('fake');
  if (fake && LIVE_HOSTS.includes(new URL(c.PUBLIC_URL).hostname)) {
    throw new Error('Invalid configuration: PUBLIC_URL is the live site, but a payment or message integration is fake');
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
    integrations: { absa: c.ABSA_MODE, daraja: c.DARAJA_MODE, whatsapp: c.WHATSAPP_MODE, storage: c.STORAGE_MODE, email: c.SMTP_HOST ? 'live' : 'fake' },
    publicUrl: c.PUBLIC_URL.replace(/\/$/, ''),
    // Development gets a fixed secret; production refuses to start without its own (above).
    absa: { secret: c.ABSA_CALLBACK_SECRET || 'dev-callback-secret', paybill: c.ABSA_PAYBILL, fakeDelayMs: c.FAKE_STK_DELAY_MS },
    mail: {
      from: c.MAIL_FROM,
      outboxDir: c.MAIL_OUTBOX_DIR,
      smtp: c.SMTP_HOST ? { host: c.SMTP_HOST, port: c.SMTP_PORT, user: c.SMTP_USER, pass: c.SMTP_PASS } : null,
    },
    whatsapp: { outboxDir: c.WHATSAPP_OUTBOX_DIR },
  };
}
