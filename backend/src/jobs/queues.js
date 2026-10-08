// @ts-check
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * The job queue (docs/BACKEND_RUNBOOK.md, sections 2 and 4): BullMQ on our Redis, every key under
 * `nb:bull`. The API adds jobs after its transactions commit; the worker (src/worker.js) runs them
 * with the handlers in ./handlers. One queue, jobs told apart by name.
 *
 * @typedef {'settle-stk' | 'stk-query' | 'process-c2b' | 'send-notification' | 'expire-unpaid' | 'outbox-sweep'} JobName
 *
 * @typedef {object} Jobs
 * @property {(name: JobName, data: Record<string, unknown>, options?: { delayMs?: number; jobId?: string }) => Promise<void>} enqueue
 *   `jobId` makes a job unique: adding it again while it is known does nothing.
 * @property {(name: JobName, everyMs: number) => Promise<void>} schedule A job that repeats.
 * @property {() => Promise<void>} close
 */

export const QUEUE = 'work';
export const PREFIX = 'nb:bull';

/** Retries with backoff; completed jobs trimmed to the last 1,000, failed kept 7 days (section 2.2). */
export const JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: { age: 7 * 86_400 },
};

/**
 * @param {string} redisUrl
 * @returns {Jobs}
 */
export function createJobs(redisUrl) {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000, lazyConnect: true });
  const queue = new Queue(QUEUE, { connection, prefix: PREFIX, defaultJobOptions: JOB_OPTIONS });
  return {
    async enqueue(name, data, { delayMs, jobId } = {}) {
      await queue.add(name, data, { ...(delayMs ? { delay: delayMs } : {}), ...(jobId ? { jobId } : {}) });
    },
    async schedule(name, everyMs) {
      await queue.upsertJobScheduler(name, { every: everyMs }, { name, data: {} });
    },
    async close() {
      await queue.close();
      connection.disconnect();
    },
  };
}
