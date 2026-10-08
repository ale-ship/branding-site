import { afterEach, describe, expect, it, vi } from 'vitest';

// The visitor's request headers, as next/headers would give them inside a request.
const visitorHeaders = new Headers();
vi.mock('next/headers', () => ({ headers: async () => visitorHeaders }));
import { orderCategories, orderProducts } from './data/order-catalogue';
import { liveApi } from './live';
import { mockApi } from './mock';
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

  it('leaves the site content on the mock', () => {
    expect(liveApi.listServices).toBe(mockApi.listServices);
    expect(liveApi.requestSignInCode).toBe(mockApi.requestSignInCode);
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

  it('answers null for an order that isn’t found or isn’t yours, and for access the API can’t check yet', async () => {
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

  it('says what comes after placing isn’t online yet, instead of asking the mock about an order it doesn’t have', async () => {
    const fetchMock = stubFetch(() => json(200, {}));
    const err = await liveApi.startPayment(placed.ref, { token: placed.token }, '0722530301').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OrderError);
    expect(err).toMatchObject({ code: 'invalid_state' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
