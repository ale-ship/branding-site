import { afterEach, describe, expect, it, vi } from 'vitest';
import { orderCategories, orderProducts } from './data/order-catalogue';
import { liveApi } from './live';
import { mockApi } from './mock';
import { OrderError } from './order-types';
import type { PriceRequest } from './types';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function stubFetch(answer: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => answer(String(url), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

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

  it('leaves everything after B1 on the mock', () => {
    expect(liveApi.createOrder).toBe(mockApi.createOrder);
    expect(liveApi.getOrder).toBe(mockApi.getOrder);
    expect(liveApi.listServices).toBe(mockApi.listServices);
  });
});
