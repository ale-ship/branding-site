/**
 * Routing Paybill (C2B) payments to orders: Absa C2B on Paybill 303030 (owner, 6 Oct 2026).
 *
 * Pure and dependency-free so the backend can use it as it is (docs/BACKEND_RUNBOOK.md,
 * "Payments"): the backend receives Absa's confirmation, normalises it with an adapter below, asks
 * `routeC2B` which order it belongs to, then records it in the payment ledger, which refuses a
 * receipt number it has seen before. The mock order system uses the same code today.
 *
 * Matching, in order:
 *   1. The order number in the account reference. Customers type `2055268420#NB123456`; the
 *      number is found anywhere in the reference, in any common form (NB123456, NB-123456, nb 123456).
 *   2. Without one: the payer's phone and the exact amount due, if exactly one waiting order fits.
 *      (Safaricom may mask the payer's number in C2B; a masked number never matches.)
 *   3. Otherwise unmatched, with the reason, for staff to assign by hand.
 */

/** A C2B confirmation, whatever the provider sent, in one shape. */
export type C2BConfirmation = {
  /** The M-Pesa receipt (TransID), unique per payment. */
  receipt: string;
  amount: number;
  /** The payer as +2547…, or null when missing or masked. */
  msisdn: string | null;
  /** What the customer typed as the account number. */
  billRef: string;
  shortCode: string;
  /** ISO time. */
  paidAt: string;
  payerName: string;
};

export type C2BCandidate = {
  ref: string;
  status: string;
  dueNow: number;
  customerPhone: string;
};

export type C2BRoute =
  | { kind: 'matched'; ref: string; by: 'reference' | 'phone-and-amount' }
  | { kind: 'unmatched'; reason: 'wrong-shortcode' | 'unknown-order' | 'ambiguous' | 'no-match' };

/** Statuses in which an order is waiting for money. */
const WAITING = ['awaiting_payment', 'awaiting_balance'];

/** The order number in a free-text reference, as `NB-123456`, or null. */
export function orderRefFromBillRef(billRef: string): string | null {
  const m = /(?:^|[^A-Z0-9])NB[\s\-_.]?(\d{6})(?!\d)/i.exec(` ${billRef}`);
  return m ? `NB-${m[1]}` : null;
}

/** Safaricom-style MSISDN to +254…, or null if missing, masked or malformed. */
export function normaliseMsisdn(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/[\s+]/g, '');
  if (!/^\d+$/.test(digits)) return null; // masked numbers contain * or a hash
  if (/^254[17]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  return null;
}

/** `20261006143015` (TransTime) -> ISO, read as Nairobi time (UTC+3). */
export function transTimeToIso(value: unknown): string {
  const s = String(value ?? '');
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (!m) return new Date().toISOString();
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+03:00`).toISOString();
}

/**
 * Adapter for the Daraja-style C2B confirmation body (TransID, TransAmount, MSISDN, BillRefNumber,
 * BusinessShortCode, TransTime, FirstName…). Absa's C2B is expected to forward the same fields;
 * if its documentation differs, add `fromAbsaC2B` beside this and keep everything else.
 * Returns null when the body isn't a usable confirmation.
 */
export function fromDarajaC2B(raw: unknown): C2BConfirmation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const receipt = typeof o.TransID === 'string' ? o.TransID.trim().toUpperCase() : '';
  const amount = Number(o.TransAmount);
  if (!/^[A-Z0-9]{8,12}$/.test(receipt) || !Number.isFinite(amount) || amount <= 0) return null;
  return {
    receipt,
    amount: Math.round(amount),
    msisdn: normaliseMsisdn(o.MSISDN),
    billRef: typeof o.BillRefNumber === 'string' ? o.BillRefNumber.slice(0, 100) : '',
    shortCode: String(o.BusinessShortCode ?? ''),
    paidAt: transTimeToIso(o.TransTime),
    payerName: [o.FirstName, o.MiddleName, o.LastName].filter((x) => typeof x === 'string' && x).join(' ').slice(0, 120),
  };
}

/** Which order a confirmation belongs to. `expectedShortCode` guards against another Paybill's traffic. */
export function routeC2B(c: C2BConfirmation, candidates: C2BCandidate[], expectedShortCode?: string): C2BRoute {
  if (expectedShortCode && c.shortCode && c.shortCode !== expectedShortCode) return { kind: 'unmatched', reason: 'wrong-shortcode' };

  const ref = orderRefFromBillRef(c.billRef);
  if (ref) {
    // An order closed since (expired, cancelled) still matches: the ledger flags it for a refund.
    return candidates.some((o) => o.ref === ref) ? { kind: 'matched', ref, by: 'reference' } : { kind: 'unmatched', reason: 'unknown-order' };
  }

  if (!c.msisdn) return { kind: 'unmatched', reason: 'no-match' };
  const fits = candidates.filter((o) => WAITING.includes(o.status) && o.customerPhone === c.msisdn && o.dueNow === c.amount);
  if (fits.length === 1) return { kind: 'matched', ref: fits[0]!.ref, by: 'phone-and-amount' };
  return { kind: 'unmatched', reason: fits.length > 1 ? 'ambiguous' : 'no-match' };
}
