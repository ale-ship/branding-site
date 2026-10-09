import { afterEach, describe, expect, it, vi } from 'vitest';

// The visitor's request headers and cookies, as next/headers would give them inside a request.
const visitorHeaders = new Headers();
const visitorCookies = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: async () => visitorHeaders,
  cookies: async () => ({ get: (name: string) => (visitorCookies.has(name) ? { name, value: visitorCookies.get(name) } : undefined) }),
}));
import { orderCategories, orderProducts } from './data/order-catalogue';
import { pages } from './data/pages';
import { products } from './data/products';
import { clients, projects } from './data/projects';
import { services } from './data/services';
import { liveApi } from './live';
import { OrderError } from './order-types';
import type { OrderInput, PriceRequest } from './types';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function stubFetch(answer: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => answer(String(url), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  visitorHeaders.delete('x-forwarded-for');
  visitorCookies.clear();
});

const priceRequest: PriceRequest = {
  product: 'business-cards',
  quantity: 500,
  brief: { finish: 'matte', sides: 'double', names: 1 },
  needsDesign: false,
  urgency: 'standard',
  handover: { method: 'pickup' },
};

describe('liveApi (step B1)', () => {
  it('reads the catalogue from GET /api/catalogue', async () => {
    const fetchMock = stubFetch(() => json(200, { categories: orderCategories, products: orderProducts }));
    expect(await liveApi.listOrderCategories()).toEqual(orderCategories);
    expect(await liveApi.listOrderProducts()).toEqual(orderProducts);
    expect(await liveApi.getOrderProduct('mug-branding')).toEqual(orderProducts.find((p) => p.slug === 'mug-branding'));
    expect(await liveApi.getOrderProduct('no-such-thing')).toBeNull();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:4300/api/catalogue');
  });

  it('posts the price request as it is and returns the API’s estimate', async () => {
    const estimate = { total: 7500 };
    const fetchMock = stubFetch(() => json(200, estimate));
    expect(await liveApi.priceEstimate(priceRequest)).toEqual(estimate);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/quotes/price');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(priceRequest);
    expect(init?.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('turns the API’s order errors back into OrderError, with its message', async () => {
    stubFetch(() => json(400, { error: 'invalid', message: 'The smallest order is 50 pieces.' }));
    const err = await liveApi.priceEstimate({ ...priceRequest, quantity: 10 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OrderError);
    expect(err).toMatchObject({ code: 'invalid', message: 'The smallest order is 50 pieces.' });
  });

  it('reports other failures without passing them off as order errors', async () => {
    stubFetch(() => json(503, { error: 'unavailable', message: 'Ordering is unavailable for a moment.' }));
    const unavailable = await liveApi.listOrderProducts().catch((e: unknown) => e);
    expect(unavailable).not.toBeInstanceOf(OrderError);
    expect(String(unavailable)).toContain('503');

    stubFetch(() => Promise.reject(new TypeError('fetch failed')));
    expect(String(await liveApi.listOrderCategories().catch((e: unknown) => e))).toContain('not answering');
  });

});

describe('liveApi (the website editor)', () => {
  it('reads the content from GET /api/content, cached under the content tag', async () => {
    const fetchMock = stubFetch(() => json(200, { services, projects, products, clients, pages }));
    expect(await liveApi.listServices()).toEqual(services);
    expect(await liveApi.getService('apparel')).toEqual(services.find((s) => s.slug === 'apparel'));
    expect(await liveApi.listProjects({ featured: true, limit: 2 })).toEqual(projects.filter((p) => p.featured).slice(0, 2));
    expect(await liveApi.getProject('nope')).toBeNull();
    expect(await liveApi.listProducts()).toEqual(products);
    expect(await liveApi.listClients()).toEqual(clients);
    expect((await liveApi.getPageContent()).home.process.steps).toHaveLength(5);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/content');
    expect((init as RequestInit & { next?: unknown }).next).toEqual({ revalidate: 600, tags: ['content'] });
  });
});

describe('liveApi (step B2)', () => {
  const placed = { ref: 'NB-123456', token: 'a'.repeat(32) };

  it('places an order with POST /api/orders, passing the visitor’s address on', async () => {
    visitorHeaders.set('x-forwarded-for', '6.6.6.6, 41.90.1.2');
    const fetchMock = stubFetch(() => json(201, placed));
    const input = { product: 'mug-branding' } as unknown as OrderInput;
    expect(await liveApi.createOrder(input)).toEqual(placed);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/orders');
    expect(init?.method).toBe('POST');
    expect(init?.cache).toBe('no-store');
    // nginx's own entry is the last one; anything before it came from the browser.
    expect(init?.headers).toMatchObject({ 'x-forwarded-for': '41.90.1.2', 'content-type': 'application/json' });
  });

  it('reads an order by its token, sent in a header and never in the URL', async () => {
    const order = { ref: placed.ref, status: 'awaiting_payment' };
    const fetchMock = stubFetch(() => json(200, order));
    expect(await liveApi.getOrder(placed.ref, { token: placed.token })).toEqual(order);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/orders/NB-123456');
    expect(init?.headers).toMatchObject({ 'x-order-token': placed.token });
  });

  it('looks an order up by order number and phone with POST /api/orders/lookup', async () => {
    const fetchMock = stubFetch(() => json(200, { ref: placed.ref }));
    await liveApi.getOrder(placed.ref, { phone: '+254722530301' });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/orders/lookup');
    expect(JSON.parse(String(init?.body))).toEqual({ ref: placed.ref, phone: '+254722530301' });
  });

  it('answers null for an order that isn’t found or isn’t yours, or with no session for a signed-in email', async () => {
    const fetchMock = stubFetch(() => json(404, { error: 'not_found', message: 'We couldn’t find that order.' }));
    expect(await liveApi.getOrder(placed.ref, { token: 'f'.repeat(32) })).toBeNull();
    expect(await liveApi.getOrder(placed.ref, { phone: '+254700000000' })).toBeNull();
    expect(await liveApi.getOrder(placed.ref, { token: '' })).toBeNull();
    expect(await liveApi.getOrder(placed.ref, { email: 'amina@example.co.ke' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reads the capacity calendar from GET /api/capacity', async () => {
    const calendar = { 'screen-press': { '2026-10-09': 300 } };
    const fetchMock = stubFetch(() => json(200, calendar));
    expect(await liveApi.getCapacity()).toEqual(calendar);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:4300/api/capacity');
  });

  it('says what comes after payment isn’t online yet, instead of asking the mock about an order it doesn’t have', async () => {
    const fetchMock = stubFetch(() => json(200, {}));
    const err = await liveApi.reviewSample(placed.ref, { token: placed.token }, 'approve', '').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OrderError);
    expect(err).toMatchObject({ code: 'invalid_state' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('liveApi (step B3)', () => {
  const placed = { ref: 'NB-123456', token: 'a'.repeat(32) };

  it('sends the M-Pesa prompt with POST /api/payments/stk, the order’s access in a header', async () => {
    const payment = { id: 'PAY-12345678', status: 'pending' };
    const fetchMock = stubFetch(() => json(200, payment));
    expect(await liveApi.startPayment(placed.ref, { token: placed.token }, '0722530303')).toEqual(payment);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/payments/stk');
    expect(JSON.parse(String(init?.body))).toEqual({ ref: placed.ref, phone: '0722530303' });
    expect(init?.headers).toMatchObject({ 'x-order-token': placed.token });

    await liveApi.startPayment(placed.ref, { phone: '+254722530303' }, '0722530303');
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ 'x-order-phone': '+254722530303' });
  });

  it('passes the API’s refusal on as an OrderError the pay panel can show', async () => {
    stubFetch(() => json(409, { error: 'invalid_state', message: 'Nothing is due on this order right now.' }));
    const err = await liveApi.startPayment(placed.ref, { token: placed.token }, '0722530303').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OrderError);
    expect(err).toMatchObject({ message: 'Nothing is due on this order right now.' });
  });
});

describe('liveApi (step B4)', () => {
  const placed = { ref: 'NB-123456', token: 'a'.repeat(32) };
  const checklist = { spelling: true, colours: true, size: true, quantity: true, colourVariance: true };

  it('approves a proof with POST /api/orders/:no/proofs/:version/approve', async () => {
    const fetchMock = stubFetch(() => json(200, { ref: placed.ref, status: 'awaiting_balance' }));
    expect(await liveApi.approveProof(placed.ref, { token: placed.token }, 2, checklist)).toMatchObject({ status: 'awaiting_balance' });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/orders/NB-123456/proofs/2/approve');
    expect(JSON.parse(String(init?.body))).toEqual({ checklist });
    expect(init?.headers).toMatchObject({ 'x-order-token': placed.token });
  });

  it('sends changes with their notes and pins', async () => {
    const fetchMock = stubFetch(() => json(200, { status: 'in_design' }));
    const pins = [{ x: 0.5, y: 0.25, text: 'Bigger' }];
    await liveApi.requestChanges(placed.ref, { phone: '+254722530301' }, 1, 'Make it pop', pins);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/orders/NB-123456/proofs/1/changes');
    expect(JSON.parse(String(init?.body))).toEqual({ comments: 'Make it pop', pins });
    expect(init?.headers).toMatchObject({ 'x-order-phone': '+254722530301' });
  });

  it('sends a signed-in account’s session, never its email, and answers not_found without one', async () => {
    let fetchMock = stubFetch(() => json(200, {}));
    const err = await liveApi.approveProof(placed.ref, { email: 'amina@example.co.ke' }, 1, checklist).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'not_found' });
    expect(fetchMock).not.toHaveBeenCalled();

    visitorCookies.set('nb-session', 's'.repeat(64));
    fetchMock = stubFetch(() => json(200, { ref: placed.ref }));
    await liveApi.approveProof(placed.ref, { email: 'amina@example.co.ke' }, 1, checklist);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/orders/NB-123456/proofs/1/approve');
    expect(init?.headers).toMatchObject({ 'x-account-session': 's'.repeat(64) });
    expect(JSON.stringify(init)).not.toContain('amina@example.co.ke');
  });
});

describe('liveApi (step B5: accounts)', () => {
  const session = 'a'.repeat(64);
  const account = { email: 'amina@example.co.ke', name: 'Amina', orders: [] };

  it('asks the API to email a code and never gets one back', async () => {
    const fetchMock = stubFetch(() => json(200, { sentTo: 'am•••@example.co.ke' }));
    expect(await liveApi.requestSignInCode('amina@example.co.ke')).toEqual({ sentTo: 'am•••@example.co.ke' });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/account/code');
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'amina@example.co.ke' });
  });

  it('verifies the code and passes the API’s refusal on', async () => {
    stubFetch(() => json(200, { session }));
    expect(await liveApi.verifySignInCode('amina@example.co.ke', '123456')).toEqual({ session });
    stubFetch(() => json(400, { error: 'invalid', message: 'That code isn’t right, or it has expired. Ask for a new one.' }));
    expect(await liveApi.verifySignInCode('amina@example.co.ke', '000000').catch((e: unknown) => e)).toBeInstanceOf(OrderError);
  });

  it('reads the account with the session in a header, and null once it has expired', async () => {
    let fetchMock = stubFetch(() => json(200, account));
    expect(await liveApi.getAccount(session)).toEqual(account);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:4300/api/account');
    expect(init?.headers).toMatchObject({ 'x-account-session': session });
    expect(init?.cache).toBe('no-store');
    fetchMock = stubFetch(() => json(404, { error: 'not_found', message: 'Please sign in again.' }));
    expect(await liveApi.getAccount(session)).toBeNull();
  });

  it('sends each change to its endpoint', async () => {
    const fetchMock = stubFetch(() => json(200, account));
    await liveApi.updateAccount(session, { name: 'Amina', phone: '0722530301', company: '' });
    await liveApi.saveBrandKit(session, { colours: [], typography: 'from-logo', fonts: '', logos: [], notes: '' });
    await liveApi.saveAddress(session, { label: 'Office', address: 'Loita Street', zone: 'cbd' });
    await liveApi.removeAddress(session, 'ADR-123456');
    await liveApi.reorderDraft(session, 'NB-123456');
    await liveApi.getStatement(session);
    await liveApi.createCompany(session, { name: 'Acme', kraPin: '' });
    await liveApi.addCompanyMember(session, { email: 'brian@example.co.ke', name: 'Brian', role: 'member' });
    await liveApi.removeCompanyMember(session, 'brian@example.co.ke');
    await liveApi.signOut(session);
    expect(fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${String(url).replace('http://127.0.0.1:4300', '')}`)).toEqual([
      'PUT /api/account/details',
      'PUT /api/account/brand-kit',
      'POST /api/account/addresses',
      'DELETE /api/account/addresses/ADR-123456',
      'GET /api/account/reorder/NB-123456',
      'GET /api/account/statement',
      'POST /api/account/company',
      'POST /api/account/company/members',
      'DELETE /api/account/company/members/brian%40example.co.ke',
      'POST /api/account/sign-out',
    ]);
    for (const [, init] of fetchMock.mock.calls) expect(init?.headers).toMatchObject({ 'x-account-session': session });
  });

  it('places a company order with the member’s session', async () => {
    visitorCookies.set('nb-session', session);
    const fetchMock = stubFetch(() => json(201, { ref: 'NB-123456', token: 't'.repeat(32) }));
    await liveApi.createOrder({ product: 'mug-branding', company: { id: 'CO-123456', poNumber: 'PO-1' } } as unknown as OrderInput);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'x-account-session': session });
  });
});
