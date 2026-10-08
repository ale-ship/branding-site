// @ts-check
import { randomBytes, randomInt } from 'node:crypto';

/**
 * A fake Absa that behaves like the real one (docs/BACKEND_RUNBOOK.md, section 2.3): the prompt is
 * accepted, and about 6 s later a callback goes through our real callback route. The phone's last
 * digit picks the outcome, as in the site's mock: 0 cancelled, 1 no callback at all (the status
 * query then finds nothing and the prompt times out), 2 failed, anything else paid.
 *
 * The callback body is Daraja's STK shape, which Absa is expected to mirror; the parser that reads it
 * is modules/payments/providers/absa/stk.js. State lives in Redis (`nb:fake:absa:*`, one day), or in
 * memory without Redis, so the status query works from the worker too.
 */

const CODES = {
  paid: { code: 0, desc: 'The service request is processed successfully.' },
  cancelled: { code: 1032, desc: 'Request cancelled by user' },
  failed: { code: 1, desc: 'The balance is insufficient for the transaction' },
};

/** Ten capitals and digits, like an M-Pesa receipt (SJ5ABC1DEF). */
export function fakeReceipt() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join('');
}

/**
 * The callback Absa would send for a prompt.
 * @param {string} requestId
 * @param {'paid' | 'cancelled' | 'failed'} outcome
 * @param {{ amount: number; phone: string; receipt: string }} p
 */
export function stkCallbackBody(requestId, outcome, p) {
  const { code, desc } = CODES[outcome];
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: `fake-${requestId.slice(-8)}`,
        CheckoutRequestID: requestId,
        ResultCode: code,
        ResultDesc: desc,
        ...(outcome === 'paid'
          ? {
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: p.amount },
                  { Name: 'MpesaReceiptNumber', Value: p.receipt },
                  { Name: 'TransactionDate', Value: 20261008120000 },
                  { Name: 'PhoneNumber', Value: Number(p.phone.replace('+', '')) },
                ],
              },
            }
          : {}),
      },
    },
  };
}

/**
 * @param {object} o
 * @param {Pick<import('ioredis').Redis, 'get' | 'set'> | null} o.redis
 * @param {(body: unknown) => Promise<unknown>} o.deliver Posts a callback to our callback route.
 * @param {number} [o.delayMs]
 * @param {import('../../lib/logger.js').Logger} [o.logger]
 * @returns {import('./index.js').AbsaClient}
 */
export function createFakeAbsa({ redis, deliver, delayMs = 6000, logger }) {
  /** @type {Map<string, string>} */
  const memory = new Map();
  /** @param {string} id */
  const keyOf = (id) => `nb:fake:absa:${id}`;
  /** @param {string} id @param {object} v */
  const save = async (id, v) => (redis ? redis.set(keyOf(id), JSON.stringify(v), 'EX', 86_400) : memory.set(keyOf(id), JSON.stringify(v)));
  /** @param {string} id */
  const load = async (id) => {
    const raw = redis ? await redis.get(keyOf(id)) : memory.get(keyOf(id));
    return raw ? JSON.parse(raw) : null;
  };

  return {
    mode: 'fake',
    async stkPush({ phone, amount }) {
      const requestId = `ws_CO_${randomBytes(8).toString('hex')}`;
      const last = phone.at(-1);
      const outcome = last === '0' ? 'cancelled' : last === '1' ? 'silent' : last === '2' ? 'failed' : 'paid';
      const record = { phone, amount, outcome, receipt: fakeReceipt() };
      await save(requestId, record);
      if (outcome !== 'silent') {
        setTimeout(() => {
          deliver(stkCallbackBody(requestId, outcome, record)).catch((err) => logger?.warn({ err }, 'fake absa: callback not delivered'));
        }, delayMs);
      }
      return { requestId };
    },
    async stkQuery(requestId) {
      const r = await load(requestId);
      if (!r || r.outcome === 'silent') return { state: 'pending' };
      if (r.outcome === 'paid') return { state: 'paid', receipt: r.receipt, amount: r.amount, phone: r.phone };
      return r.outcome === 'cancelled'
        ? { state: 'cancelled', message: 'The request was cancelled on the phone.' }
        : { state: 'failed', message: 'M-Pesa declined the payment (for example, not enough balance).' };
    },
  };
}
