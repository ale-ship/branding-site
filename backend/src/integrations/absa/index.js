// @ts-check
import { createFakeAbsa } from './fake.js';
import { createLiveAbsa } from './live.js';

/**
 * Absa M-Pesa (docs/BACKEND_RUNBOOK.md, sections 2.3 and 6): STK Push and its status query. Services
 * import only this file; `ABSA_MODE` picks the fake or the real client.
 *
 * @typedef {object} StkRequest
 * @property {string} phone +2547XXXXXXXX
 * @property {number} amount Whole shillings.
 * @property {string} accountRef The order number, shown on the customer's phone.
 * @property {string} description
 *
 * @typedef {{ state: 'paid'; receipt: string; amount: number; phone: string | null }
 *   | { state: 'failed' | 'cancelled' | 'timeout'; message: string }
 *   | { state: 'pending' }} StkStatus
 *
 * @typedef {object} AbsaClient
 * @property {'fake' | 'live'} mode
 * @property {(request: StkRequest) => Promise<{ requestId: string }>} stkPush
 * @property {(requestId: string) => Promise<StkStatus>} stkQuery
 */

/**
 * @param {'fake' | 'live'} mode
 * @param {Parameters<typeof createFakeAbsa>[0]} fakeOptions
 * @returns {AbsaClient}
 */
export function createAbsa(mode, fakeOptions) {
  return mode === 'live' ? createLiveAbsa() : createFakeAbsa(fakeOptions);
}
