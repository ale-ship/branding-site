// @ts-check
import { AppError } from '../../lib/errors.js';
import { findNotification, markAttempt, markSent, pendingBefore } from './repo.js';
import { subjectFor } from './templates.js';

/**
 * Sending the outbox (docs/BACKEND_RUNBOOK.md, section 4, notifications): WhatsApp and email, never
 * SMS. A message row is written in the same transaction as its event; after commit it is queued, and
 * the worker sends it here, outside any transaction. A failed send is retried with backoff (the job
 * queue) and given up after five tries. A sweep every minute queues anything left waiting.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 */

const MAX_ATTEMPTS = 5;
const SWEEP_AFTER_MS = 2 * 60_000;

/**
 * Queues messages for the worker, once each (the job id is the message's). Never throws: a message
 * that isn't queued now is picked up by the sweep.
 * @param {Deps} deps
 * @param {number[]} ids
 */
export async function queueNotifications(deps, ids) {
  if (!deps.jobs) return;
  for (const id of ids) {
    await deps.jobs.enqueue('send-notification', { id }, { jobId: `notify-${id}` }).catch((err) => deps.logger?.warn({ err, id }, 'message not queued; the sweep will'));
  }
}

/**
 * @param {Deps} deps
 * @param {number} id
 * @param {Date} [now]
 * @returns {Promise<'sent' | 'skipped'>}
 */
export async function sendNotification(deps, id, now = new Date()) {
  const { pool, whatsapp, mailer } = deps;
  if (!pool || !whatsapp || !mailer) throw new AppError(503, 'unavailable', 'Messages are unavailable.');
  const n = await findNotification(pool, id);
  if (!n || n.status !== 'pending') return 'skipped';
  try {
    if (n.channel === 'whatsapp') await whatsapp.send({ to: n.recipient, template: n.template, text: n.payload.text });
    else await mailer.send({ to: n.recipient, subject: subjectFor(n.template, n.payload), text: emailBody(n.payload.text) });
  } catch (err) {
    const attempts = await markAttempt(pool, id, MAX_ATTEMPTS);
    deps.logger?.warn({ err, id, channel: n.channel, attempts }, 'message not sent');
    throw err;
  }
  await markSent(pool, id, now);
  return 'sent';
}

/**
 * Queues every message still waiting after two minutes (the API restarted, Redis was down…).
 * @param {Deps} deps
 * @param {Date} [now]
 * @returns {Promise<number>}
 */
export async function sweepOutbox(deps, now = new Date()) {
  if (!deps.pool) return 0;
  const ids = await pendingBefore(deps.pool, new Date(now.getTime() - SWEEP_AFTER_MS));
  await queueNotifications(deps, ids);
  return ids.length;
}

/** @param {string} text */
const emailBody = (text) =>
  `${text}\n\nNoorcom Branding\n${FOOTER}\n\nYou get this email because you ordered from us. Reply to it to reach us.`;

// The site's business details (src/lib/site.ts); the backend can't import the site's code.
const FOOTER = 'Chuka Elimu Plaza, 1st Floor, Loita Street, Nairobi · +254 722 530 301 · noorcombranding.co.ke';
