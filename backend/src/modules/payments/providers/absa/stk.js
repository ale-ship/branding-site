// @ts-check
import { normaliseMsisdn } from '@noorcom-branding/shared/rules/c2b.js';

/**
 * Absa's STK callback body → what the payment service needs. Read as Daraja's shape (Body.stkCallback
 * with ResultCode and CallbackMetadata.Item), which Absa is expected to mirror; replace this file's
 * insides when Absa's documentation and a sample (test/fixtures/absa/) arrive. Returns null when the
 * body isn't a usable callback.
 *
 * @typedef {{ requestId: string } & ({ state: 'paid'; receipt: string; amount: number; phone: string | null }
 *   | { state: 'failed' | 'cancelled' | 'timeout'; message: string })} StkResult
 */

/** Customer-facing words for each way a prompt can end without money. */
export const STK_MESSAGES = {
  cancelled: 'The request was cancelled on the phone.',
  timeout: 'No answer on the phone within a minute.',
  failed: 'M-Pesa declined the payment (for example, not enough balance).',
};

/**
 * @param {unknown} body
 * @returns {StkResult | null}
 */
export function parseStkCallback(body) {
  const cb = /** @type {any} */ (body)?.Body?.stkCallback;
  if (!cb || typeof cb.CheckoutRequestID !== 'string' || cb.ResultCode === undefined) return null;
  const requestId = cb.CheckoutRequestID;
  const code = Number(cb.ResultCode);
  if (code === 1032) return { requestId, state: 'cancelled', message: STK_MESSAGES.cancelled };
  if (code === 1037) return { requestId, state: 'timeout', message: STK_MESSAGES.timeout };
  if (code !== 0) return { requestId, state: 'failed', message: STK_MESSAGES.failed };

  /** @type {Record<string, unknown>} */
  const items = {};
  for (const it of Array.isArray(cb.CallbackMetadata?.Item) ? cb.CallbackMetadata.Item : []) items[it?.Name] = it?.Value;
  const receipt = typeof items.MpesaReceiptNumber === 'string' ? items.MpesaReceiptNumber.trim().toUpperCase() : '';
  const amount = Math.round(Number(items.Amount));
  if (!/^[A-Z0-9]{8,12}$/.test(receipt) || !Number.isFinite(amount) || amount <= 0) return null;
  return { requestId, state: 'paid', receipt, amount, phone: normaliseMsisdn(items.PhoneNumber) };
}
