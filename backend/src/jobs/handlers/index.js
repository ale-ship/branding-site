// @ts-check
import { sendNotification, sweepOutbox } from '../../modules/notifications/service.js';
import { expireUnpaid } from '../../modules/orders/service.js';
import { processC2B } from '../../modules/payments/c2b.service.js';
import { queryStk, settleStkCallback } from '../../modules/payments/service.js';

/**
 * What each job does (docs/BACKEND_RUNBOOK.md, section 4, jobs). Handlers only call services; the
 * worker (src/worker.js) runs them, and tests call `runJob` directly. A handler that throws is
 * retried by the queue with backoff.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../queues.js').JobName} JobName
 */

/** @type {Record<JobName, (deps: Deps, data: any) => Promise<unknown>>} */
export const handlers = {
  'settle-stk': (deps, { callbackId }) => settleStkCallback(deps, callbackId),
  'stk-query': (deps, { requestId }) => queryStk(deps, requestId),
  'process-c2b': (deps, { id }) => processC2B(deps, id),
  'send-notification': (deps, { id }) => sendNotification(deps, id),
  'expire-unpaid': (deps) => expireUnpaid(deps),
  'outbox-sweep': (deps) => sweepOutbox(deps),
};

/**
 * @param {Deps} deps
 * @param {string} name
 * @param {unknown} data
 */
export async function runJob(deps, name, data) {
  const handler = handlers[/** @type {JobName} */ (name)];
  if (!handler) throw new Error(`No handler for job ${name}`);
  return handler(deps, data ?? {});
}
