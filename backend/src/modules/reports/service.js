// @ts-check
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { AppError } from '../../lib/errors.js';
import { METHOD, PURPOSE, REASON, STATUS, dayLabel, kes, number, periodLabel } from './labels.js';
import * as repo from './repo.js';

/**
 * The admin's reports (owner, 8 Oct 2026): sales (invoices issued), payments received, money owed,
 * sales by product, and Paybill money that needed a hand. Each is one table document, which the back
 * office shows and downloads as PDF or CSV, so the three always agree.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../../lib/pdf.js').TableDocument} TableDocument
 * @typedef {TableDocument & { kind: string; period: { from: string; to: string } }} Report
 * @typedef {Record<string, any>} Row
 */

export const KINDS = /** @type {const} */ (['sales', 'payments', 'receivables', 'products', 'suspense']);
/** @typedef {typeof KINDS[number]} Kind */

const sum = (/** @type {Row[]} */ rows, /** @type {string} */ key) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);

/**
 * The period asked for, or this month so far; at most ten years.
 * @param {{ from?: string; to?: string }} q
 * @param {Date} [now]
 */
export function periodOf({ from, to }, now = new Date()) {
  const today = nairobiToday(now);
  const period = { from: from ?? `${today.slice(0, 8)}01`, to: to ?? today };
  if (period.from > period.to) throw new AppError(400, 'invalid_period', 'The start date is after the end date.');
  if (Date.parse(period.to) - Date.parse(period.from) > 3653 * 86_400_000) throw new AppError(400, 'invalid_period', 'Pick ten years or less.');
  return period;
}

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'Reports are unavailable for a moment.');
  return deps.pool;
}

/** @type {Record<Kind, (db: import('./repo.js').Db, p: { from: string; to: string }) => Promise<Omit<Report, 'kind' | 'period' | 'subtitle'> & { subtitle?: string }>>} */
const BUILD = {
  async sales(db, { from, to }) {
    const rows = (await repo.invoices(db, from, to))
      .filter((r) => r.invoiced > 0 || r.amount_paid > 0)
      .map((r) => ({
        invoice: r.invoice_no,
        date: r.day,
        order: r.order_no,
        customer: r.customer_company ? `${r.customer_name}, ${r.customer_company}` : r.customer_name,
        product: r.product,
        qty: r.quantity,
        status: STATUS[r.status] ?? r.status,
        invoiced: r.invoiced,
        paid: r.amount_paid,
        balance: r.invoiced - r.amount_paid,
      }));
    const [invoiced, paid] = [sum(rows, 'invoiced'), sum(rows, 'paid')];
    return {
      title: 'Sales report',
      landscape: true,
      summary: [
        { label: 'Invoices', value: number.format(rows.length) },
        { label: 'Invoiced', value: kes(invoiced) },
        { label: 'Paid on them', value: kes(paid) },
        { label: 'Still owed', value: kes(invoiced - paid) },
      ],
      columns: [
        { key: 'invoice', label: 'Invoice', weight: 1.1 },
        { key: 'date', label: 'Date', weight: 1.1 },
        { key: 'order', label: 'Order', weight: 1.1 },
        { key: 'customer', label: 'Customer', weight: 2.2 },
        { key: 'product', label: 'Product', weight: 2 },
        { key: 'qty', label: 'Qty', weight: 0.6 },
        { key: 'status', label: 'Status', weight: 1.3 },
        { key: 'invoiced', label: 'Invoiced (KES)', money: true, weight: 1.1 },
        { key: 'paid', label: 'Paid (KES)', money: true, weight: 1.1 },
        { key: 'balance', label: 'Balance (KES)', money: true, weight: 1.1 },
      ],
      rows,
      totals: { invoice: 'Totals', invoiced, paid, balance: invoiced - paid },
      note: 'An order counts once its first payment is in, under the date its invoice was issued. Orders waiting for their first payment, or that expired unpaid, are left out; a cancelled order counts only for what was paid on it. “Paid” is everything paid on the order to date.',
    };
  },

  async payments(db, { from, to }) {
    const rows = (await repo.payments(db, from, to)).map((r) => ({
      receipt: r.receipt_no,
      date: r.day,
      order: r.order_no,
      customer: r.customer_name,
      method: METHOD[r.method] ?? r.method,
      mpesa: r.mpesa_receipt,
      purpose: PURPOSE[r.purpose] ?? r.purpose,
      amount: r.amount,
    }));
    const by = (/** @type {string} */ m) => sum(rows.filter((r) => r.method === METHOD[m]), 'amount');
    return {
      title: 'Payments received',
      summary: [
        { label: 'Received', value: kes(sum(rows, 'amount')) },
        { label: 'Payments', value: number.format(rows.length) },
        { label: 'By M-Pesa prompt', value: kes(by('stk')) },
        { label: 'By Paybill', value: kes(by('paybill')) },
      ],
      columns: [
        { key: 'receipt', label: 'Receipt', weight: 1.1 },
        { key: 'date', label: 'Date', weight: 1.1 },
        { key: 'order', label: 'Order', weight: 1.1 },
        { key: 'customer', label: 'Customer', weight: 1.8 },
        { key: 'method', label: 'Method', weight: 1.2 },
        { key: 'mpesa', label: 'M-Pesa ref', weight: 1.3 },
        { key: 'purpose', label: 'For', weight: 1 },
        { key: 'amount', label: 'Amount (KES)', money: true, weight: 1.1 },
      ],
      rows,
      totals: { receipt: 'Total', amount: sum(rows, 'amount') },
      note: 'Every confirmed M-Pesa payment, with Noorcom’s receipt number (RCT). Paybill payments nobody could match are in the suspense report until they are assigned to an order.',
    };
  },

  async receivables(db, { to }) {
    const rows = (await repo.receivables(db, to)).map((r) => ({
      order: r.order_no,
      invoice: r.invoice_no,
      placed: r.placed,
      customer: r.customer_name,
      phone: r.customer_phone,
      status: STATUS[r.status] ?? r.status,
      age: r.age,
      invoiced: r.invoiced,
      paid: r.amount_paid,
      balance: r.balance,
    }));
    const aged = (/** @type {number} */ lo, /** @type {number} */ hi) => kes(sum(rows.filter((r) => r.age >= lo && r.age <= hi), 'balance'));
    return {
      title: 'Money owed',
      subtitle: `As at ${dayLabel(to)}`,
      landscape: true,
      summary: [
        { label: 'Owed', value: kes(sum(rows, 'balance')) },
        { label: 'Orders', value: number.format(rows.length) },
        { label: '0–30 days', value: aged(0, 30) },
        { label: '31–60 days', value: aged(31, 60) },
        { label: '61–90 days', value: aged(61, 90) },
        { label: 'Over 90 days', value: aged(91, Infinity) },
      ],
      columns: [
        { key: 'order', label: 'Order', weight: 1.1 },
        { key: 'invoice', label: 'Invoice', weight: 1.1 },
        { key: 'placed', label: 'Placed', weight: 1.1 },
        { key: 'customer', label: 'Customer', weight: 2 },
        { key: 'phone', label: 'Phone', weight: 1.4 },
        { key: 'status', label: 'Status', weight: 1.3 },
        { key: 'age', label: 'Days', weight: 0.6 },
        { key: 'invoiced', label: 'Invoiced (KES)', money: true, weight: 1.1 },
        { key: 'paid', label: 'Paid (KES)', money: true, weight: 1.1 },
        { key: 'balance', label: 'Owed (KES)', money: true, weight: 1.1 },
      ],
      rows,
      totals: { order: 'Totals', invoiced: sum(rows, 'invoiced'), paid: sum(rows, 'paid'), balance: sum(rows, 'balance') },
      note: 'Open orders that still owe money, such as a balance due on proof approval or before handover; “Days” counts from the day the order was placed. Orders waiting for their first payment are left out: they expire unpaid after 48 hours.',
    };
  },

  async products(db, { from, to }) {
    const rows = (await repo.byProduct(db, from, to)).map((r) => ({ ...r }));
    return {
      title: 'Sales by product',
      summary: [
        { label: 'Orders', value: number.format(sum(rows, 'orders')) },
        { label: 'Pieces', value: number.format(sum(rows, 'pieces')) },
        { label: 'Invoiced', value: kes(sum(rows, 'invoiced')) },
        { label: 'Paid', value: kes(sum(rows, 'paid')) },
      ],
      columns: [
        { key: 'product', label: 'Product', weight: 2.4 },
        { key: 'category', label: 'Category', weight: 1.6 },
        { key: 'orders', label: 'Orders', weight: 0.8 },
        { key: 'pieces', label: 'Pieces', weight: 0.9 },
        { key: 'invoiced', label: 'Invoiced (KES)', money: true, weight: 1.2 },
        { key: 'paid', label: 'Paid (KES)', money: true, weight: 1.2 },
      ],
      rows,
      totals: { product: 'Totals', orders: sum(rows, 'orders'), pieces: sum(rows, 'pieces'), invoiced: sum(rows, 'invoiced'), paid: sum(rows, 'paid') },
      note: 'Orders placed in the period that went ahead (their first payment is in); expired and cancelled ones are left out.',
    };
  },

  async suspense(db, { from, to }) {
    const rows = (await repo.suspense(db, from, to)).map((r) => ({
      mpesa: r.trans_id,
      date: r.day,
      payer: [r.body.FirstName, r.body.LastName].filter(Boolean).join(' '),
      phone: r.body.MSISDN ?? '',
      reference: r.body.BillRefNumber ?? '',
      amount: Math.round(Number(r.body.TransAmount) || 0),
      reason: REASON[r.reason] ?? r.reason ?? '',
      outcome: r.status === 'assigned' ? `Assigned to ${r.order_no ?? 'an order'}` : r.status === 'refund' ? 'To refund' : 'Waiting',
    }));
    const of = (/** @type {(o: string) => boolean} */ test) => kes(sum(rows.filter((r) => test(r.outcome)), 'amount'));
    return {
      title: 'Paybill suspense',
      landscape: true,
      summary: [
        { label: 'Waiting', value: of((o) => o === 'Waiting') },
        { label: 'Assigned by staff', value: of((o) => o.startsWith('Assigned')) },
        { label: 'To refund', value: of((o) => o === 'To refund') },
      ],
      columns: [
        { key: 'mpesa', label: 'M-Pesa ref', weight: 1.3 },
        { key: 'date', label: 'Date', weight: 1.1 },
        { key: 'payer', label: 'Payer', weight: 1.6 },
        { key: 'phone', label: 'Phone', weight: 1.3 },
        { key: 'reference', label: 'Account typed', weight: 1.8 },
        { key: 'reason', label: 'Why unmatched', weight: 1.8 },
        { key: 'outcome', label: 'Outcome', weight: 1.5 },
        { key: 'amount', label: 'Amount (KES)', money: true, weight: 1.1 },
      ],
      rows,
      totals: { mpesa: 'Total', amount: sum(rows, 'amount') },
      note: 'Paybill payments that did not match an order by themselves: waiting for staff, assigned to an order by staff, or to be refunded.',
    };
  },
};

/**
 * @param {Deps} deps
 * @param {Kind} kind
 * @param {{ from?: string; to?: string }} q
 * @param {Date} [now]
 * @returns {Promise<Report>}
 */
export async function report(deps, kind, q, now = new Date()) {
  // Money owed is as at today: what was paid is today's figure, so an earlier "as at" would be wrong.
  const period = kind === 'receivables' ? { from: nairobiToday(now), to: nairobiToday(now) } : periodOf(q, now);
  const built = await BUILD[kind](need(deps), period);
  return { kind, period, subtitle: periodLabel(period), ...built };
}
