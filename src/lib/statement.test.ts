import { describe, expect, it } from 'vitest';
import type { Order, OrderPayment } from './api/order-types';
import { buildStatement, statementCsv } from './statement';

const pay = (amount: number, at: string, receiptNo: string, status: OrderPayment['status'] = 'confirmed'): OrderPayment => ({
  id: receiptNo,
  purpose: 'deposit',
  method: 'stk',
  phone: null,
  amount,
  status,
  mpesaReceipt: `MP${receiptNo}`,
  receiptNo,
  requestedAt: at,
  settledAt: at,
  message: null,
});

const order = (over: Partial<Order>): Order =>
  ({
    ref: 'NB-100001',
    invoiceNo: 'INV00001',
    createdAt: '2026-10-05T08:00:00.000Z',
    status: 'in_production',
    product: { slug: 'business-cards', name: 'Business cards', category: 'stationery' },
    total: 6500,
    amountPaid: 0,
    estimate: { dueNow: { amount: 3250 } },
    payments: [],
    company: null,
    ...over,
  }) as Order;

describe('the statement of account', () => {
  it('lists invoices and payments oldest first with a running balance', () => {
    const s = buildStatement([
      order({ payments: [pay(3250, '2026-10-05T08:05:00.000Z', 'RCT00001'), pay(100, '2026-10-05T08:06:00.000Z', 'RCT00009', 'failed')] }),
      order({
        ref: 'NB-100002',
        invoiceNo: 'INV00002',
        createdAt: '2026-10-06T08:00:00.000Z',
        total: null,
        estimate: { dueNow: { amount: 2500 } } as Order['estimate'],
        company: { id: 'CO-1', name: 'Kamau Foods', poNumber: 'LPO-77', approvers: [] },
      }),
    ]);
    expect(s.lines.map((l) => [l.document, l.debit, l.credit, l.balance])).toEqual([
      ['INV00001', 6500, 0, 6500],
      ['RCT00001', 0, 3250, 3250],
      ['INV00002', 2500, 0, 5750],
    ]);
    expect(s.lines[2]!.description).toBe('Business cards, PO LPO-77');
    expect(s).toMatchObject({ invoiced: 9000, paid: 3250, balance: 5750 });
  });

  it('counts an expired order only for what was paid on it', () => {
    const s = buildStatement([order({ status: 'expired', amountPaid: 500, payments: [pay(500, '2026-10-08T08:00:00.000Z', 'RCT00002')] })]);
    expect(s.balance).toBe(0);
    expect(buildStatement([order({ status: 'expired' })]).lines).toEqual([]);
  });

  it('writes CSV that spreadsheets read safely', () => {
    const csv = statementCsv(buildStatement([order({ product: { slug: 'x', name: '=HYPERLINK("x"), cards', category: 'print' } })]));
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Date,Order,Document,Description,Debit (KES),Credit (KES),Balance (KES)');
    expect(lines[1]).toBe(`2026-10-05,NB-100001,INV00001,"'=HYPERLINK(""x""), cards",6500,,6500`);
    expect(lines.at(-1)).toBe(',,,Totals,6500,0,6500');
  });
});
