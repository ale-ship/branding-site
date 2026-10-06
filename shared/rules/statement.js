// @ts-check

/**
 * @typedef {import('../contract/order-types.js').Order} Order
 * @typedef {import('../contract/order-types.js').Statement} Statement
 * @typedef {import('../contract/order-types.js').StatementLine} StatementLine
 * @typedef {Omit<StatementLine, 'balance'>} Entry
 */

/**
 * A statement of account (spec, Phase 4 "reports"): each order's invoice as a debit and each confirmed
 * payment as a credit, oldest first, with a running balance. Expired and cancelled orders count only
 * for money actually paid on them. Pure, so the backend's statements match the site's.
 */

/**
 * What an order has invoiced so far: its total, or the survey fee while a site job has no firm price.
 * @param {Pick<Order, 'status' | 'total' | 'estimate' | 'amountPaid'>} order
 * @returns {number}
 */
export function invoicedAmount(order) {
  if (order.status === 'expired' || order.status === 'cancelled') return order.amountPaid;
  return order.total ?? order.estimate.dueNow.amount;
}

/**
 * @param {Order[]} orders
 * @returns {Statement}
 */
export function buildStatement(orders) {
  /** @type {Entry[]} */
  const entries = [];
  for (const o of orders) {
    const amount = invoicedAmount(o);
    if (amount > 0) {
      entries.push({ date: o.createdAt, ref: o.ref, document: o.invoiceNo, description: `${o.product.name}${o.company?.poNumber ? `, PO ${o.company.poNumber}` : ''}`, debit: amount, credit: 0 });
    }
    for (const p of o.payments) {
      if (p.status !== 'confirmed' || !p.settledAt) continue;
      entries.push({ date: p.settledAt, ref: o.ref, document: p.receiptNo ?? '', description: `${p.method === 'stk' ? 'M-Pesa' : 'Paybill'} ${p.mpesaReceipt ?? ''}`.trim(), debit: 0, credit: p.amount });
    }
  }
  // Oldest first; on the same moment the invoice comes before its payment.
  entries.sort((a, b) => a.date.localeCompare(b.date) || b.debit - a.debit);
  let balance = 0;
  const lines = entries.map((e) => ({ ...e, balance: (balance += e.debit - e.credit) }));
  const invoiced = entries.reduce((s, e) => s + e.debit, 0);
  const paid = entries.reduce((s, e) => s + e.credit, 0);
  return { lines, invoiced, paid, balance: invoiced - paid };
}

/**
 * @param {string | number} v
 * @returns {string}
 */
const csvCell = (v) => {
  if (typeof v === 'number') return String(v);
  // Quote anything with commas, quotes or line breaks; neutralise text that a spreadsheet would run as a formula.
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * The statement as CSV, for spreadsheets and accounting software.
 * @param {Statement} s
 * @returns {string}
 */
export function statementCsv(s) {
  /** @type {(string | number)[][]} */
  const rows = [['Date', 'Order', 'Document', 'Description', 'Debit (KES)', 'Credit (KES)', 'Balance (KES)']];
  for (const l of s.lines) rows.push([l.date.slice(0, 10), l.ref, l.document, l.description, l.debit || '', l.credit || '', l.balance]);
  rows.push(['', '', '', 'Totals', s.invoiced, s.paid, s.balance]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
