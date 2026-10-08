import { describe, expect, it } from 'vitest';
import { applyPayment } from '../../src/modules/payments/apply.js';
import { parseStkCallback } from '../../src/modules/payments/providers/absa/stk.js';
import { stkCallbackBody } from '../../src/integrations/absa/fake.js';

/** What a confirmed payment does to an order: the same rules as the site's mock. */
const order = (over = {}) => ({
  ref: 'NB-123456',
  status: 'awaiting_payment',
  mechanism: 'A',
  needsDesign: false,
  total: 10_000,
  amountPaid: 0,
  credit: 0,
  dueNow: 5_000,
  duePurpose: 'deposit',
  leadDays: 5,
  ...over,
});
const TODAY = '2026-10-08';

describe('applyPayment', () => {
  it('moves a paid deposit on to design and stops the order expiring', () => {
    const r = applyPayment(order(), 5_000, 'RCT00001', TODAY);
    expect(r).toMatchObject({ status: 'in_design', amountPaid: 5_000, dueNow: 0, duePurpose: null, credit: 0, stopExpiry: true, attention: null });
    expect(r.events).toEqual(['Deposit paid. We’re checking your artwork.']);
    expect(r.message).toBe('Payment received for NB-123456, receipt RCT00001. We’ve started on your order.');
  });

  it('words the first step by what the order needs', () => {
    expect(applyPayment(order({ needsDesign: true, duePurpose: 'full', dueNow: 10_000 }), 10_000, 'R', TODAY).events).toEqual(['Paid in full. A designer is on your brief.']);
    expect(applyPayment(order({ mechanism: 'B', total: null, duePurpose: 'survey_fee', dueNow: 2_500 }), 2_500, 'R', TODAY).events).toEqual(['Survey fee paid. Choose your survey date.']);
    expect(applyPayment(order({ mechanism: 'B', duePurpose: 'deposit' }), 5_000, 'R', TODAY).events).toEqual(['Deposit paid. A designer is on your job.']);
  });

  it('keeps an underpaid step where it is, with the rest still due', () => {
    const r = applyPayment(order(), 2_000, 'RCT00002', TODAY);
    expect(r).toMatchObject({ status: 'awaiting_payment', amountPaid: 2_000, dueNow: 3_000, duePurpose: 'deposit', stopExpiry: false });
    expect(r.events).toEqual(['Part payment of KES 2,000 received; KES 3,000 still due.']);
    expect(r.message).toContain('KES 3,000 is still due');
  });

  it('keeps only money beyond the whole total as credit', () => {
    // 7,000 against a 5,000 deposit on a 10,000 order: no credit, the balance is simply smaller.
    expect(applyPayment(order(), 7_000, 'R', TODAY)).toMatchObject({ status: 'in_design', amountPaid: 7_000, credit: 0 });
    const over = applyPayment(order(), 12_000, 'R', TODAY);
    expect(over).toMatchObject({ credit: 2_000 });
    expect(over.events[0]).toBe('Paid KES 2,000 more than the total; kept as credit.');
  });

  it('keeps anything beyond what was due as credit while there is no total (site jobs)', () => {
    const r = applyPayment(order({ mechanism: 'B', total: null, duePurpose: 'survey_fee', dueNow: 2_500 }), 3_000, 'R', TODAY);
    expect(r).toMatchObject({ credit: 500, status: 'in_design' });
  });

  it('starts production when the balance is paid, with the promised date from today', () => {
    const r = applyPayment(order({ status: 'in_production', duePurpose: 'balance' }), 1, 'R', TODAY);
    expect(r.production).toBeNull();
    const b = applyPayment(order({ status: 'awaiting_balance', amountPaid: 5_000, dueNow: 5_000, duePurpose: 'balance' }), 5_000, 'RCT00009', TODAY);
    expect(b).toMatchObject({ status: 'in_production', dueNow: 0, production: { startedOn: TODAY, promisedDate: '2026-10-15' } });
    expect(b.message).toBe('Balance received for NB-123456, receipt RCT00009. Printing has started.');
  });

  it('completes a site job when its balance is paid', () => {
    const r = applyPayment(order({ mechanism: 'B', status: 'awaiting_balance', amountPaid: 5_000, dueNow: 5_000, duePurpose: 'balance' }), 5_000, 'R', TODAY);
    expect(r.status).toBe('completed');
  });

  it('keeps money for a closed order as credit and tells staff', () => {
    const r = applyPayment(order({ status: 'expired', dueNow: 0, duePurpose: null }), 5_000, 'RCT00003', TODAY);
    expect(r).toMatchObject({ status: 'expired', amountPaid: 5_000, credit: 5_000, attention: 'paid-after-close' });
    expect(r.message).toContain('after the order had closed');
  });

  it('thanks the customer for money when nothing was due', () => {
    const r = applyPayment(order({ status: 'in_design', dueNow: 0, duePurpose: null, amountPaid: 5_000 }), 1_000, 'RCT00004', TODAY);
    expect(r).toMatchObject({ status: 'in_design', amountPaid: 6_000, credit: 0 });
    expect(r.message).toBe('We received KES 1,000 for NB-123456, receipt RCT00004. Thank you.');
  });
});

describe('parseStkCallback (Daraja-shaped, until Absa’s samples arrive)', () => {
  const paid = stkCallbackBody('ws_CO_1', 'paid', { amount: 3500, phone: '+254722530303', receipt: 'SJ5ABC1DEF' });

  it('reads a paid callback', () => {
    expect(parseStkCallback(paid)).toEqual({ requestId: 'ws_CO_1', state: 'paid', receipt: 'SJ5ABC1DEF', amount: 3500, phone: '+254722530303' });
  });

  it('reads the ways a prompt ends without money', () => {
    expect(parseStkCallback(stkCallbackBody('a', 'cancelled', { amount: 1, phone: '+254700000000', receipt: 'X' }))).toMatchObject({ state: 'cancelled' });
    expect(parseStkCallback(stkCallbackBody('a', 'failed', { amount: 1, phone: '+254700000000', receipt: 'X' }))).toMatchObject({ state: 'failed' });
    expect(parseStkCallback({ Body: { stkCallback: { CheckoutRequestID: 'a', ResultCode: 1037 } } })).toMatchObject({ state: 'timeout' });
  });

  it('refuses what isn’t a usable callback', () => {
    expect(parseStkCallback(null)).toBeNull();
    expect(parseStkCallback({ hello: 'world' })).toBeNull();
    const noReceipt = structuredClone(paid);
    noReceipt.Body.stkCallback.CallbackMetadata.Item = [{ Name: 'Amount', Value: 10 }];
    expect(parseStkCallback(noReceipt)).toBeNull();
  });
});
