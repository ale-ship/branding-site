import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { orderProducts } from './data/order-catalogue';
import { products } from './data/products';
import { mockApi } from './mock';
import { clock, mockStaff, unmatchedPayments } from './mock-orders';
import type { ApprovalChecklist } from './order-types';
import type { OrderInput } from './order-types';

const T0 = Date.parse('2026-10-05T07:00:00Z'); // Monday 10:00 in Nairobi
let now = T0;
beforeEach(() => {
  now = T0;
  clock.now = () => now;
});
afterEach(() => {
  clock.now = () => Date.now();
});
const later = (ms: number) => (now += ms);

const common: OrderInput['common'] = {
  colours: [],
  typography: 'from-logo',
  fonts: '',
  assets: [],
  inspiration: [],
  inspirationLinks: [],
  text: '',
  styles: [],
  artwork: 'need-design',
  notes: '',
};
const ticked: ApprovalChecklist = { spelling: true, colours: true, size: true, quantity: true, colourVariance: true };
const customer = { name: 'Amina Otieno', company: '', phone: '+254722530303', email: 'amina@example.co.ke' };

function teesInput(quantity = 100): OrderInput {
  return {
    product: 't-shirt-printing',
    quantity,
    brief: { garmentColour: 'White', sizes: { S: quantity, M: 0, L: 0, XL: 0, XXL: 0 }, positions: ['front'], method: 'heat', printColours: 1 },
    needsDesign: true,
    urgency: 'standard',
    handover: { method: 'pickup' },
    common,
    customer,
  };
}

async function place(input: OrderInput = teesInput()) {
  const { ref, token } = await mockApi.createOrder(input);
  return { ref, token, access: { token } };
}

describe('the order catalogue', () => {
  it('prices shop items from the shop’s own price and minimum', () => {
    for (const p of orderProducts) {
      if (p.mechanism !== 'A' || !p.shopSlug) continue;
      const shop = products.find((s) => s.slug === p.shopSlug)!;
      expect(shop, p.slug).toBeDefined();
      const first = [...p.priceTiers].sort((a, b) => a.minQty - b.minQty)[0]!;
      expect(first.unitPrice, p.slug).toBe(shop.pricePerPiece);
      expect(p.minQuantity, p.slug).toBe(shop.minQuantity);
      expect(first.minQty, p.slug).toBe(p.minQuantity);
    }
  });

  it('gives every category at least one product, and every product a category', async () => {
    const categories = await mockApi.listOrderCategories();
    for (const c of categories) expect(orderProducts.some((p) => p.category === c.slug), c.slug).toBe(true);
    for (const p of orderProducts) expect(categories.some((c) => c.slug === p.category), p.slug).toBe(true);
  });
});

describe('createOrder and getOrder', () => {
  it('prices the order on the server and awaits the deposit', async () => {
    const { ref, access } = await place();
    expect(ref).toMatch(/^NB-\d{6}$/);
    const order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('awaiting_payment');
    expect(order.total).toBe(100 * 600 + 2000); // tier price and the design fee
    expect(order.dueNow).toBe(31000);
    expect(order.invoiceNo).toMatch(/^INV\d{5}$/);
    expect(order.notifications.map((n) => n.channel).sort()).toEqual(['email', 'whatsapp']);
    expect('token' in order).toBe(false);
  });

  it('opens the order with the secret link or the phone, and nothing else', async () => {
    const { ref } = await place();
    expect(await mockApi.getOrder(ref, { token: 'wrong' })).toBeNull();
    expect(await mockApi.getOrder(ref, { phone: '0722 530 303' })).not.toBeNull();
    expect(await mockApi.getOrder(ref, { phone: '0722 530 309' })).toBeNull();
    expect(await mockApi.getOrder('NB-000000', { phone: '0722 530 303' })).toBeNull();
  });

  it('refuses orders under the minimum or with an unavailable deadline', async () => {
    await expect(mockApi.createOrder(teesInput(10))).rejects.toThrow('The minimum is 50 pieces.');
    await expect(mockApi.createOrder({ ...teesInput(300), urgency: 'rush' })).rejects.toThrow(/deadline/);
  });

  it('expires an unpaid order after 48 hours', async () => {
    const { ref, access } = await place();
    later(49 * 3_600_000);
    const order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('expired');
    expect(order.dueNow).toBe(0);
  });
});

describe('STK Push (simulated)', () => {
  it('moves the order only once the callback confirms', async () => {
    const { ref, access } = await place();
    const payment = await mockApi.startPayment(ref, access, '0722 530 303');
    expect(payment.status).toBe('pending');
    expect((await mockApi.getOrder(ref, access))!.status).toBe('awaiting_payment');
    later(7_000);
    const order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('in_design');
    expect(order.amountPaid).toBe(31000);
    expect(order.payments[0]!.mpesaReceipt).toMatch(/^[A-Z0-9]{10}$/);
    expect(order.expiresAt).toBeNull();
  });

  it('reports cancelled, failed and timed-out prompts, and keeps the order waiting', async () => {
    for (const [phone, status] of [['0722530300', 'cancelled'], ['0722530302', 'failed'], ['0722530301', 'timeout']] as const) {
      const { ref, access } = await place();
      await mockApi.startPayment(ref, access, phone);
      later(61_000);
      const order = (await mockApi.getOrder(ref, access))!;
      expect(order.payments[0]!.status, phone).toBe(status);
      expect(order.status, phone).toBe('awaiting_payment');
    }
  });

  it('sends one prompt at a time', async () => {
    const { ref, access } = await place();
    const a = await mockApi.startPayment(ref, access, '0722530303');
    const b = await mockApi.startPayment(ref, access, '0722530303');
    expect(b.id).toBe(a.id);
  });

  it('refuses a payment when nothing is due', async () => {
    const { ref, access } = await place();
    await mockApi.startPayment(ref, access, '0722530303');
    later(7_000);
    await expect(mockApi.startPayment(ref, access, '0722530303')).rejects.toThrow('Nothing is due');
  });
});

describe('Paybill (C2B) and the payment rules', () => {
  it('never credits the same receipt twice', async () => {
    const { ref, access } = await place();
    expect(mockStaff.paybill(ref, 31000, 'SJ5ABC1DEF')).toBe(true);
    expect(mockStaff.paybill(ref, 31000, 'SJ5ABC1DEF')).toBe(false);
    expect(mockStaff.repeatLastCallback(ref)).toBe(false);
    expect((await mockApi.getOrder(ref, access))!.amountPaid).toBe(31000);
  });

  it('keeps an underpaid order waiting, with the rest still due', async () => {
    const { ref, access } = await place();
    mockStaff.paybill(ref, 10000);
    let order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('awaiting_payment');
    expect(order.dueNow).toBe(21000);
    mockStaff.paybill(ref, 21000);
    order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('in_design');
  });

  it('keeps money beyond the total as credit', async () => {
    const { ref, access } = await place();
    mockStaff.paybill(ref, 70000);
    const order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('in_design');
    expect(order.credit).toBe(70000 - 62000);
  });
});

describe('Absa C2B routing and receipts', () => {
  it('gives each confirmed payment its own receipt number, and only confirmed ones', async () => {
    const { ref, access } = await place();
    await mockApi.startPayment(ref, access, '0722530300'); // cancelled on the phone
    later(7_000);
    mockStaff.paybill(ref, 10000);
    mockStaff.paybill(ref, 21000);
    const order = (await mockApi.getOrder(ref, access))!;
    const numbers = order.payments.map((p) => p.receiptNo);
    expect(numbers[0]).toBeNull();
    expect(numbers[1]).toMatch(/^RCT\d{5}$/);
    expect(numbers[2]).toMatch(/^RCT\d{5}$/);
    expect(numbers[1]).not.toBe(numbers[2]);
  });

  it('matches a Paybill payment without the order number by phone and exact amount', async () => {
    // Its own phone: other waiting orders with the same phone and amount would (rightly) be ambiguous.
    const { ref, access } = await place({ ...teesInput(), customer: { ...customer, phone: '+254722530388' } });
    expect(mockStaff.paybillWithoutReference(ref, 31000)).toEqual({ kind: 'matched', ref, by: 'phone-and-amount' });
    expect((await mockApi.getOrder(ref, access))!.status).toBe('in_design');
  });

  it('holds a payment it can’t match for staff', async () => {
    const { ref, access } = await place();
    const before = unmatchedPayments.length;
    expect(mockStaff.paybillWithoutReference(ref, 12345)).toEqual({ kind: 'unmatched', reason: 'no-match' });
    expect(unmatchedPayments.length).toBe(before + 1);
    expect((await mockApi.getOrder(ref, access))!.amountPaid).toBe(0);
  });

  it('keeps money paid after the order expired as credit, flagged', async () => {
    const { ref, access } = await place();
    later(49 * 3_600_000);
    expect(mockStaff.paybill(ref, 31000)).toBe(true);
    const order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('expired');
    expect(order.credit).toBe(31000);
    expect(order.payments[0]!.message).toMatch(/flagged/);
  });
});

describe('proofs and the balance gate', () => {
  it('asks for the balance after approval, and only then starts production', async () => {
    const { ref, access } = await place();
    mockStaff.paybill(ref, 31000);
    mockStaff.uploadProof(ref);
    let order = await mockApi.requestChanges(ref, access, 1, 'Make the logo bigger', []);
    expect(order.status).toBe('in_design');
    mockStaff.uploadProof(ref);
    order = await mockApi.approveProof(ref, access, 2, ticked);
    expect(order.status).toBe('awaiting_balance');
    expect(order.dueNow).toBe(31000);
    expect(() => mockStaff.logProgress(ref)).toThrow(/production/);
    await mockApi.startPayment(ref, access, '0722530303');
    later(7_000);
    order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('in_production');
    mockStaff.logProgress(ref, 60);
    mockStaff.logProgress(ref, 60);
    order = (await mockApi.getOrder(ref, access))!;
    expect(order.progress).toMatchObject({ kind: 'pieces', done: 100, total: 100 });
    expect(order.status).toBe('ready');
    expect(order.production.logs.map((l) => l.pieces)).toEqual([60, 40]);
    // Dates count from the day production started.
    expect(order.production.startedOn).toBe('2026-10-05');
    expect(order.production.promisedBy! > order.production.startedOn!).toBe(true);
  });

  it('needs every checklist item ticked to approve', async () => {
    const { ref, access } = await place();
    mockStaff.paybill(ref, 31000);
    mockStaff.uploadProof(ref);
    await expect(mockApi.approveProof(ref, access, 1, { ...ticked, colourVariance: false })).rejects.toThrow(/checklist/);
    const order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('awaiting_approval');
    expect(order.proofs[0]!.image).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(order.proofs[0]!.image)).toContain('PROOF');
  });

  it('keeps pinned notes on the version they were made on', async () => {
    const { ref, access } = await place();
    mockStaff.paybill(ref, 31000);
    mockStaff.uploadProof(ref);
    await expect(mockApi.requestChanges(ref, access, 1, '', [])).rejects.toThrow(/what to change/);
    const pins = [{ x: 0.2, y: 0.3, text: 'Bigger logo here' }];
    let order = await mockApi.requestChanges(ref, access, 1, '', pins);
    expect(order.proofs[0]).toMatchObject({ status: 'changes_requested', pins, comments: null });
    mockStaff.uploadProof(ref);
    order = (await mockApi.getOrder(ref, access))!;
    expect(order.proofs.map((p) => p.version)).toEqual([1, 2]);
    expect(order.proofs[1]!.pins).toEqual([]);
    expect(order.proofs[1]!.image).not.toBe(order.proofs[0]!.image);
  });

  it('can’t approve an old or missing proof', async () => {
    const { ref, access } = await place();
    await expect(mockApi.approveProof(ref, access, 1, ticked)).rejects.toThrow(/can’t be approved/);
  });
});

describe('production and handover', () => {
  async function inProduction(input: OrderInput) {
    const placed = await place(input);
    const first = (await mockApi.getOrder(placed.ref, placed.access))!;
    mockStaff.paybill(placed.ref, first.dueNow);
    mockStaff.uploadProof(placed.ref);
    const approved = await mockApi.approveProof(placed.ref, placed.access, 1, ticked);
    if (approved.dueNow) mockStaff.paybill(placed.ref, approved.dueNow);
    return placed;
  }

  it('holds a big run until its sample is approved', async () => {
    const { ref, access } = await inProduction({ ...teesInput(250), customer: { ...customer, phone: '+254722530401' } });
    let order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('in_production');
    expect(order.sample?.status).toBe('waiting');
    expect(() => mockStaff.logProgress(ref, 50)).toThrow(/sample/);
    mockStaff.uploadSample(ref);
    await expect(mockApi.reviewSample(ref, access, 'changes', '')).rejects.toThrow(/what to change/);
    order = await mockApi.reviewSample(ref, access, 'changes', 'The print is too light');
    expect(order.sample).toMatchObject({ status: 'changes_requested', comments: 'The print is too light' });
    mockStaff.uploadSample(ref);
    order = await mockApi.reviewSample(ref, access, 'approve', '');
    expect(order.sample?.status).toBe('approved');
    mockStaff.logProgress(ref, 100);
    expect((await mockApi.getOrder(ref, access))!.progress).toMatchObject({ done: 100, total: 250 });
  });

  it('skips the sample for small runs', async () => {
    const { ref, access } = await inProduction({ ...teesInput(100), customer: { ...customer, phone: '+254722530404' } });
    expect((await mockApi.getOrder(ref, access))!.sample).toBeNull();
  });

  it('gives a pickup code, and completes only when the code matches', async () => {
    const { ref, access } = await inProduction({ ...teesInput(100), customer: { ...customer, phone: '+254722530402' } });
    mockStaff.logProgress(ref, 100);
    mockStaff.handOver(ref);
    const order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('out_for_handover');
    expect(order.pickupCode).toMatch(/^\d{6}$/);
    expect(order.notifications.at(-1)!.text).toContain(order.pickupCode!);
    const wrong = order.pickupCode === '000000' ? '111111' : '000000';
    expect(mockStaff.collect(ref, wrong, 'Brian')).toBe(false);
    expect(mockStaff.collect(ref, order.pickupCode!, 'Brian')).toBe(true);
    const done = (await mockApi.getOrder(ref, access))!;
    expect(done.status).toBe('completed');
    expect(done.handedOver).toMatchObject({ method: 'pickup', detail: 'Collected by Brian, code checked.' });
  });

  it('delivers an early batch as its own record, then the rest', async () => {
    const input: OrderInput = { ...teesInput(150), handover: { method: 'delivery', zone: 'inner', address: 'Westlands' }, customer: { ...customer, phone: '+254722530403' } };
    const { ref, access } = await inProduction(input);
    await expect(mockApi.requestPartialDelivery(ref, access, 50)).rejects.toThrow(/No finished pieces/);
    mockStaff.logProgress(ref, 60);
    await expect(mockApi.requestPartialDelivery(ref, access, 61)).rejects.toThrow(/Only 60/);
    let order = await mockApi.requestPartialDelivery(ref, access, 50);
    expect(order.deliveries).toHaveLength(1);
    await expect(mockApi.requestPartialDelivery(ref, access, 10)).rejects.toThrow(/already on its way/);
    mockStaff.advanceEarlyDelivery(ref);
    mockStaff.advanceEarlyDelivery(ref);
    order = (await mockApi.getOrder(ref, access))!;
    expect(order.deliveries[0]).toMatchObject({ pieces: 50, partial: true, status: 'delivered', rider: 'Kevin Mwangi', recipient: 'Amina Otieno' });
    mockStaff.logProgress(ref, 90);
    mockStaff.handOver(ref);
    mockStaff.handOver(ref);
    order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('completed');
    expect(order.deliveries.map((d) => [d.pieces, d.partial, d.status])).toEqual([
      [50, true, 'delivered'],
      [100, false, 'delivered'],
    ]);
  });
});

describe('site jobs (B)', () => {
  const surveyInput: OrderInput = {
    product: 'indoor-branding-job',
    quantity: 1,
    brief: { siteAddress: 'Loita Street', space: 'office', surfaces: ['walls'], surveyDates: ['2026-10-07', '2026-10-08'] },
    needsDesign: true,
    urgency: 'standard',
    handover: { method: 'install', address: 'Loita Street' },
    common,
    customer,
  };

  it('takes the survey fee, then books the survey', async () => {
    const { ref, access } = await place(surveyInput);
    let order = (await mockApi.getOrder(ref, access))!;
    expect(order.total).toBeNull();
    expect(order.duePurpose).toBe('survey_fee');
    await expect(mockApi.bookSurvey(ref, access, '2026-10-07')).rejects.toThrow('Pay the survey fee first.');
    mockStaff.paybill(ref, 2500);
    order = await mockApi.bookSurvey(ref, access, '2026-10-07');
    expect(order.survey).toEqual({ preferred: ['2026-10-07', '2026-10-08'], booked: '2026-10-07' });
    expect(order.progress.kind).toBe('stages');
  });
});
