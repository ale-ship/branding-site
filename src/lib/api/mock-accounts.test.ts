import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockApi } from './mock';
import { clock, mockStaff } from './mock-orders';
import type { ApprovalChecklist, OrderInput } from './order-types';

const T0 = Date.parse('2026-10-06T07:00:00Z'); // Tuesday 10:00 in Nairobi
let now = T0;
beforeEach(() => {
  now = T0;
  clock.now = () => now;
});
afterEach(() => {
  clock.now = () => Date.now();
});
const later = (ms: number) => (now += ms);
const ticked: ApprovalChecklist = { spelling: true, colours: true, size: true, quantity: true, colourVariance: true };

const common: OrderInput['common'] = {
  colours: ['#D7000F'],
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

const input = (phone: string, over: Partial<OrderInput> = {}): OrderInput => ({
  product: 'business-cards',
  quantity: 100,
  brief: { finish: 'matte', sides: 'double', names: 1 },
  needsDesign: true,
  urgency: 'standard',
  handover: { method: 'pickup' },
  common,
  customer: { name: 'Wanjiru Kamau', company: 'Kamau Foods', phone, email: 'wanjiru@example.co.ke' },
  ...over,
});

async function signIn(phone: string) {
  const sent = await mockApi.requestSignInCode(phone);
  return (await mockApi.verifySignInCode(phone, sent.demoCode!)).session;
}

describe('sign-in with a WhatsApp code', () => {
  it('signs in with the right code, once', async () => {
    const sent = await mockApi.requestSignInCode('0711 222 301');
    expect(sent.sentTo).toBe('07•• ••• 301');
    expect(sent.demoCode).toMatch(/^\d{6}$/);
    const wrong = sent.demoCode === '000000' ? '111111' : '000000';
    await expect(mockApi.verifySignInCode('0711222301', wrong)).rejects.toThrow(/isn’t right/);
    const { session } = await mockApi.verifySignInCode('+254711222301', sent.demoCode!);
    expect((await mockApi.getAccount(session))?.phone).toBe('+254711222301');
    await expect(mockApi.verifySignInCode('0711222301', sent.demoCode!)).rejects.toThrow(/isn’t right/);
  });

  it('limits resends, tries and the code’s life', async () => {
    await mockApi.requestSignInCode('0711222302');
    await expect(mockApi.requestSignInCode('0711222302')).rejects.toThrow(/just sent/);
    later(61_000);
    const sent = await mockApi.requestSignInCode('0711222302');
    for (let i = 0; i < 5; i++) await expect(mockApi.verifySignInCode('0711222302', '000000' === sent.demoCode ? '111111' : '000000')).rejects.toThrow();
    await expect(mockApi.verifySignInCode('0711222302', sent.demoCode!)).rejects.toThrow(/isn’t right/);
    later(61_000);
    const again = await mockApi.requestSignInCode('0711222302');
    later(11 * 60_000);
    await expect(mockApi.verifySignInCode('0711222302', again.demoCode!)).rejects.toThrow(/expired/);
  });

  it('ends the session on sign-out and after thirty days', async () => {
    const session = await signIn('0711222303');
    await mockApi.signOut(session);
    expect(await mockApi.getAccount(session)).toBeNull();
    const second = await signIn('0711222303');
    later(31 * 86_400_000);
    expect(await mockApi.getAccount(second)).toBeNull();
    await expect(mockApi.saveBrandKit(second, { colours: [], typography: 'from-logo', fonts: '', logos: [], notes: '' })).rejects.toThrow(/sign in again/);
  });
});

describe('the account', () => {
  it('shows guest orders placed with the phone, and starts from the latest order’s details', async () => {
    await mockApi.createOrder(input('+254711222304'));
    await mockApi.createOrder(input('+254711222399'));
    const session = await signIn('0711222304');
    const account = (await mockApi.getAccount(session))!;
    expect(account.orders).toHaveLength(1);
    expect(account).toMatchObject({ name: 'Wanjiru Kamau', company: 'Kamau Foods', email: 'wanjiru@example.co.ke' });
  });

  it('keeps a brand kit and up to five addresses', async () => {
    const session = await signIn('0711222305');
    let account = await mockApi.saveBrandKit(session, { colours: ['#D7000F'], typography: 'named', fonts: 'Inter', logos: [{ name: 'logo.svg', size: 1, type: 'image/svg+xml' }], notes: '' });
    expect(account.brandKit?.fonts).toBe('Inter');
    for (let i = 0; i < 5; i++) account = await mockApi.saveAddress(session, { label: `A${i}`, address: 'Loita Street', zone: 'cbd' });
    await expect(mockApi.saveAddress(session, { label: 'A6', address: 'Loita Street', zone: 'cbd' })).rejects.toThrow(/Up to 5/);
    account = await mockApi.saveAddress(session, { id: account.addresses[0]!.id, label: 'Office', address: 'Mpaka Road', zone: 'inner' });
    expect(account.addresses[0]).toMatchObject({ label: 'Office', zone: 'inner' });
    account = await mockApi.removeAddress(session, account.addresses[0]!.id);
    expect(account.addresses).toHaveLength(4);
  });

  it('reorders a printed order with its approved artwork and no design fee', async () => {
    const { ref, token } = await mockApi.createOrder(input('+254711222306'));
    const session = await signIn('0711222306');
    await expect(mockApi.reorderDraft(session, ref)).rejects.toThrow(/approved design/);
    mockStaff.paybill(ref, (await mockApi.getOrder(ref, { token }))!.dueNow);
    mockStaff.uploadProof(ref);
    await mockApi.approveProof(ref, { token }, 1, ticked);
    expect((await mockApi.getAccount(session))!.orders[0]!.canReorder).toBe(true);
    const draft = await mockApi.reorderDraft(session, ref);
    expect(draft).toMatchObject({ from: ref, product: 'business-cards', quantity: 100, urgency: 'standard' });
    expect(draft.common.artwork).toBe('print-ready');
    expect(draft.common.notes).toContain(`Reorder of ${ref}`);
    const other = await signIn('0711222307');
    await expect(mockApi.reorderDraft(other, ref)).rejects.toThrow(/couldn’t find/);
  });
});

describe('site jobs (B), end to end', () => {
  it('survey fee → survey → firm quote → deposit → design → install → sign-off → balance', async () => {
    const { ref, token } = await mockApi.createOrder(
      input('+254711222308', {
        product: 'indoor-branding-job',
        quantity: 1,
        brief: { siteAddress: 'Loita Street', space: 'office', surfaces: ['walls', 'signs'], surveyDates: ['2026-10-08'] },
        handover: { method: 'install', address: 'Loita Street' },
      }),
    );
    const access = { token };
    mockStaff.paybill(ref, 2500);
    expect(() => mockStaff.completeSurvey(ref)).toThrow(/isn’t booked/);
    await mockApi.bookSurvey(ref, access, '2026-10-08');
    mockStaff.completeSurvey(ref);
    let order = (await mockApi.getOrder(ref, access))!;
    expect(order.siteQuote).toMatchObject({ status: 'pending', validUntil: '2026-10-20' });
    expect(order.siteQuote!.lines.map((l) => l.label)).toEqual(['Feature wall', 'Reception sign', 'Installation']);
    await expect(mockApi.bookSurvey(ref, access, '2026-10-09')).rejects.toThrow(/survey is done/);

    order = await mockApi.acceptSiteQuote(ref, access);
    const total = order.siteQuote!.total;
    expect(order).toMatchObject({ status: 'awaiting_payment', duePurpose: 'deposit', dueNow: Math.round(total / 2), total, expiresAt: null });
    mockStaff.paybill(ref, order.dueNow);
    order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('in_design');

    mockStaff.uploadProof(ref);
    order = await mockApi.approveProof(ref, access, 1, ticked);
    expect(order.status).toBe('in_production');
    await expect(mockApi.bookInstall(ref, access, '2026-10-07')).rejects.toThrow(/two working days/);
    mockStaff.logProgress(ref); // materials printed
    expect(() => mockStaff.logProgress(ref)).toThrow(/installation date/);
    order = await mockApi.bookInstall(ref, access, '2026-10-09');
    expect(order.installDate).toBe('2026-10-09');
    mockStaff.logProgress(ref); // installed
    mockStaff.logProgress(ref); // signed off
    order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('awaiting_balance');
    // The survey fee comes off the balance.
    expect(order.dueNow).toBe(total - Math.round(total / 2) - 2500);
    expect(order.handedOver?.method).toBe('install');
    mockStaff.paybill(ref, order.dueNow);
    order = (await mockApi.getOrder(ref, access))!;
    expect(order.status).toBe('completed');
    expect(order.progress).toMatchObject({ done: 7, total: 7 });
    expect(order.amountPaid).toBe(total);
  });

  it('won’t take an expired quote', async () => {
    const { ref, token } = await mockApi.createOrder(
      input('+254711222309', {
        product: 'vehicle-branding-job',
        quantity: 1,
        brief: { vehicle: 'Toyota Probox 2018', count: 2, coverage: 'full', surveyDates: ['2026-10-08'] },
        handover: { method: 'install', address: 'Our yard' },
      }),
    );
    mockStaff.paybill(ref, 1500);
    await mockApi.bookSurvey(ref, { token }, '2026-10-08');
    mockStaff.completeSurvey(ref);
    later(15 * 86_400_000);
    await expect(mockApi.acceptSiteQuote(ref, { token })).rejects.toThrow(/expired/);
  });
});

describe('company accounts', () => {
  it('lets the owner add people, and only approvers approve company proofs', async () => {
    const owner = await signIn('0711222310');
    await mockApi.updateAccount(owner, { name: 'Wanjiru Kamau', email: '', company: 'Kamau Foods' });
    let account = await mockApi.createCompany(owner, { name: 'Kamau Foods', kraPin: 'p051234567x' });
    expect(account.companyAccount).toMatchObject({ name: 'Kamau Foods', kraPin: 'P051234567X', role: 'owner' });
    await expect(mockApi.createCompany(owner, { name: 'Again', kraPin: '' })).rejects.toThrow(/already belongs/);
    await expect(mockApi.createCompany(await signIn('0711222319'), { name: 'Bad PIN', kraPin: '12345' })).rejects.toThrow(/KRA PIN/);
    account = await mockApi.addCompanyMember(owner, { phone: '0711222311', name: 'Otieno', role: 'member' });
    account = await mockApi.addCompanyMember(owner, { phone: '0711222312', name: 'Akinyi', role: 'approver' });
    expect(account.companyAccount!.members.map((m) => m.role)).toEqual(['owner', 'member', 'approver']);

    const member = await signIn('0711222311');
    await expect(mockApi.addCompanyMember(member, { phone: '0711222313', name: 'X', role: 'member' })).rejects.toThrow(/Only the company’s owner/);
    const companyId = (await mockApi.getAccount(member))!.companyAccount!.id;

    // A member orders for the company with a PO number.
    const { ref, token } = await mockApi.createOrder({ ...input('+254711222311'), company: { id: companyId, poNumber: 'LPO-2201' } });
    await expect(mockApi.createOrder({ ...input('+254711222399'), company: { id: companyId, poNumber: '' } })).rejects.toThrow(/not a member/);
    let order = (await mockApi.getOrder(ref, { token }))!;
    expect(order.company).toEqual({ id: companyId, name: 'Kamau Foods', poNumber: 'LPO-2201', approvers: ['Wanjiru Kamau', 'Akinyi'] });
    mockStaff.paybill(ref, order.dueNow);
    mockStaff.uploadProof(ref);
    await expect(mockApi.approveProof(ref, { token }, 1, ticked)).rejects.toThrow(/approved by Wanjiru Kamau or Akinyi/);

    // The approver sees it in their account and approves with their own phone.
    const approver = await signIn('0711222312');
    expect((await mockApi.getAccount(approver))!.companyOrders.map((o) => [o.ref, o.placedBy])).toEqual([[ref, 'Wanjiru Kamau']]);
    order = await mockApi.approveProof(ref, { phone: '0711222312' }, 1, ticked);
    expect(order.status).toBe('in_production');
    // Someone outside the company can't open it by phone.
    expect(await mockApi.getOrder(ref, { phone: '0711222399' })).toBeNull();

    account = await mockApi.removeCompanyMember(owner, '0711222311');
    expect(account.companyAccount!.members).toHaveLength(2);
    await expect(mockApi.removeCompanyMember(owner, '0711222310')).rejects.toThrow(/owner can’t be removed/);
  });

  it('gives a statement of the account’s invoices and payments', async () => {
    const { ref } = await mockApi.createOrder(input('+254711222314'));
    const session = await signIn('0711222314');
    let s = await mockApi.getStatement(session);
    expect(s.lines).toHaveLength(1);
    const due = s.balance;
    mockStaff.paybill(ref, 1000);
    s = await mockApi.getStatement(session);
    expect(s.lines.map((l) => [l.debit, l.credit])).toEqual([
      [due, 0],
      [0, 1000],
    ]);
    expect(s.balance).toBe(due - 1000);
  });
});
