// @ts-check
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { buildStatement } from '@noorcom-branding/shared/rules/statement.js';
import { AppError } from '../../lib/errors.js';
import * as repo from './repo.js';
import { dayLabel, kes, periodLabel } from './labels.js';
import { periodOf } from './service.js';

/**
 * Customer accounts (owner, 8 Oct 2026): every customer, known by the email they order with (an
 * account is its email, as on the site), with what they were invoiced, paid and owe; and each one's
 * statement of account for a period, built by the site's own rule (shared/rules/statement.js) so
 * the back office and the customer see the same figures.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('./service.js').Report} Report
 */

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'Accounts are unavailable for a moment.');
  return deps.pool;
}

/**
 * @param {Deps} deps
 * @param {string} q
 */
export async function accountList(deps, q) {
  const rows = await repo.accounts(need(deps), q.trim());
  return rows.map((r) => ({
    email: r.email,
    name: r.name,
    company: r.company,
    phone: r.phone,
    orders: r.orders,
    invoiced: r.invoiced,
    paid: r.paid,
    balance: r.balance,
    lastOrder: new Date(r.last_order).toISOString(),
  }));
}

/** The Nairobi day of a moment. */
const dayOf = (/** @type {string} */ iso) => nairobiToday(new Date(iso));

/**
 * One customer's statement for a period: the balance brought forward, each invoice (debit) and
 * payment (credit) in the period with the running balance, and the balance at the end.
 * @param {Deps} deps
 * @param {string} email
 * @param {{ from?: string; to?: string }} q
 * @param {Date} [now]
 * @returns {Promise<Report & { customer: { email: string; name: string; company: string; phone: string }; opening: number; closing: number }>}
 */
export async function statement(deps, email, q, now = new Date()) {
  const period = periodOf(q, now);
  const { orders, payments } = await repo.statementOf(need(deps), email.trim().toLowerCase());
  const latest = orders.at(-1);
  if (!latest) throw new AppError(404, 'not_found', 'No orders were placed with that email.');

  const all = buildStatement(
    orders.map((o) => /** @type {any} */ ({
      ref: o.order_no,
      invoiceNo: o.invoice_no,
      status: o.status,
      total: o.total,
      estimate: o.estimate,
      amountPaid: o.amount_paid,
      createdAt: new Date(o.created_at).toISOString(),
      product: o.product,
      company: null,
      payments: payments
        .filter((p) => p.order_id === o.id)
        .map((p) => ({ status: 'confirmed', settledAt: new Date(p.created_at).toISOString(), receiptNo: p.receipt_no, method: p.method, mpesaReceipt: p.mpesa_receipt, amount: p.amount })),
    })),
  );
  const before = all.lines.filter((l) => dayOf(l.date) < period.from);
  const opening = before.at(-1)?.balance ?? 0;
  const lines = all.lines.filter((l) => dayOf(l.date) >= period.from && dayOf(l.date) <= period.to);
  const invoiced = lines.reduce((s, l) => s + l.debit, 0);
  const paid = lines.reduce((s, l) => s + l.credit, 0);
  const closing = opening + invoiced - paid;
  const customer = { email: email.trim().toLowerCase(), name: latest.customer_name, company: latest.customer_company, phone: latest.customer_phone };

  return {
    kind: 'statement',
    period,
    customer,
    opening,
    closing,
    title: 'Statement of account',
    subtitle: periodLabel(period),
    meta: [
      ['Customer', customer.company ? `${customer.name}, ${customer.company}` : customer.name],
      ['Email', customer.email],
      ['Phone', customer.phone],
    ],
    summary: [
      { label: 'Brought forward', value: kes(opening) },
      { label: 'Invoiced', value: kes(invoiced) },
      { label: 'Paid', value: kes(paid) },
      { label: closing < 0 ? 'In credit' : 'Balance due', value: kes(Math.abs(closing)) },
    ],
    columns: [
      { key: 'date', label: 'Date', weight: 1.1 },
      { key: 'order', label: 'Order', weight: 1 },
      { key: 'document', label: 'Document', weight: 1 },
      { key: 'description', label: 'Description', weight: 2.4 },
      { key: 'debit', label: 'Debit (KES)', money: true, weight: 1 },
      { key: 'credit', label: 'Credit (KES)', money: true, weight: 1 },
      { key: 'balance', label: 'Balance (KES)', money: true, weight: 1.1 },
    ],
    rows: [
      { date: dayLabel(period.from), description: 'Balance brought forward', balance: opening },
      ...lines.map((l) => ({ date: dayLabel(dayOf(l.date)), order: l.ref, document: l.document, description: l.description, debit: l.debit || null, credit: l.credit || null, balance: l.balance })),
    ],
    totals: { description: 'Totals for the period', debit: invoiced, credit: paid, balance: closing },
    note: 'Each order’s invoice is a debit and each confirmed M-Pesa payment a credit. A negative balance is money Noorcom holds for the customer: credit for a next order, or a refund due.',
  };
}
