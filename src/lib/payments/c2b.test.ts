import { describe, expect, it } from 'vitest';
import { invoiceIssuer } from '../site';
import { fromDarajaC2B, normaliseMsisdn, orderRefFromBillRef, routeC2B, transTimeToIso, type C2BCandidate, type C2BConfirmation } from './c2b';

describe('orderRefFromBillRef', () => {
  it.each([
    ['2055268420#NB123456', 'NB-123456'],
    ['NB-123456', 'NB-123456'],
    ['nb 123456', 'NB-123456'],
    ['nb_123456 deposit', 'NB-123456'],
    ['Order NB.654321', 'NB-654321'],
  ])('%s -> %s', (ref, expected) => {
    expect(orderRefFromBillRef(ref)).toBe(expected);
  });

  it.each(['2055268420', 'NB12345', 'NB1234567', 'XNB123456', ''])('finds nothing in %s', (ref) => {
    expect(orderRefFromBillRef(ref)).toBeNull();
  });

  it('reads back the account format the site tells customers to type', () => {
    expect(orderRefFromBillRef(invoiceIssuer.paybillAccount('NB-123456'))).toBe('NB-123456');
  });
});

describe('the Daraja-style adapter', () => {
  const body = {
    TransactionType: 'Pay Bill',
    TransID: 'sj5abc1def',
    TransTime: '20261006143015',
    TransAmount: '31000.00',
    BusinessShortCode: '303030',
    BillRefNumber: '2055268420#NB123456',
    MSISDN: '254722530303',
    FirstName: 'AMINA',
    LastName: 'OTIENO',
  };

  it('normalises a confirmation', () => {
    expect(fromDarajaC2B(body)).toEqual({
      receipt: 'SJ5ABC1DEF',
      amount: 31000,
      msisdn: '+254722530303',
      billRef: '2055268420#NB123456',
      shortCode: '303030',
      paidAt: '2026-10-06T11:30:15.000Z',
      payerName: 'AMINA OTIENO',
    });
  });

  it('refuses bodies that aren’t payments', () => {
    expect(fromDarajaC2B(null)).toBeNull();
    expect(fromDarajaC2B({ ...body, TransAmount: '0' })).toBeNull();
    expect(fromDarajaC2B({ ...body, TransID: 'x' })).toBeNull();
  });

  it('treats a masked phone as unknown', () => {
    expect(normaliseMsisdn('2547 ***** 303')).toBeNull();
    expect(normaliseMsisdn('0722530303')).toBe('+254722530303');
    expect(transTimeToIso('bad')).toMatch(/T/);
  });
});

describe('routeC2B', () => {
  const pay = (over: Partial<C2BConfirmation> = {}): C2BConfirmation => ({
    receipt: 'SJ5ABC1DEF',
    amount: 31000,
    msisdn: '+254722530303',
    billRef: '2055268420#NB123456',
    shortCode: '303030',
    paidAt: '2026-10-06T11:30:15.000Z',
    payerName: 'AMINA OTIENO',
    ...over,
  });
  const orders: C2BCandidate[] = [
    { ref: 'NB-123456', status: 'awaiting_payment', dueNow: 31000, customerPhone: '+254722530303' },
    { ref: 'NB-222222', status: 'awaiting_balance', dueNow: 5000, customerPhone: '+254700000001' },
    { ref: 'NB-333333', status: 'awaiting_payment', dueNow: 5000, customerPhone: '+254700000001' },
    { ref: 'NB-444444', status: 'expired', dueNow: 0, customerPhone: '+254711111111' },
  ];

  it('matches by the order number first', () => {
    expect(routeC2B(pay(), orders, '303030')).toEqual({ kind: 'matched', ref: 'NB-123456', by: 'reference' });
    expect(routeC2B(pay({ billRef: '2055268420#NB444444' }), orders)).toEqual({ kind: 'matched', ref: 'NB-444444', by: 'reference' });
  });

  it('falls back to phone and exact amount when only one waiting order fits', () => {
    expect(routeC2B(pay({ billRef: '2055268420' }), orders)).toEqual({ kind: 'matched', ref: 'NB-123456', by: 'phone-and-amount' });
    expect(routeC2B(pay({ billRef: '2055268420', amount: 30000 }), orders)).toEqual({ kind: 'unmatched', reason: 'no-match' });
  });

  it('won’t guess between two orders, or with a masked phone', () => {
    expect(routeC2B(pay({ billRef: '2055268420', msisdn: '+254700000001', amount: 5000 }), orders)).toEqual({ kind: 'unmatched', reason: 'ambiguous' });
    expect(routeC2B(pay({ billRef: '2055268420', msisdn: null }), orders)).toEqual({ kind: 'unmatched', reason: 'no-match' });
  });

  it('flags unknown orders and other Paybills', () => {
    expect(routeC2B(pay({ billRef: 'NB999999' }), orders)).toEqual({ kind: 'unmatched', reason: 'unknown-order' });
    expect(routeC2B(pay({ shortCode: '123456' }), orders, '303030')).toEqual({ kind: 'unmatched', reason: 'wrong-shortcode' });
  });
});
