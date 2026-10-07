import { mockApi } from './mock';
import { OrderError } from './order-types';
import type { OrderCategory, OrderErrorCode, OrderProduct, PriceEstimate, SiteApi } from './types';

/**
 * SiteApi over HTTP to our backend (docs/BACKEND_RUNBOOK.md, section 12), chosen in index.ts when
 * NEXT_PUBLIC_API_MODE=live. Server side only: pages and server actions call it, the browser never
 * does. Methods move here from the mock one build step at a time; the rest still run on the mock:
 *
 *   B1  the order catalogue and the price (listOrderCategories, listOrderProducts, getOrderProduct,
 *       priceEstimate)
 *
 * Until orders move (B2), the mock still places and prices orders from shared/catalogue, which the
 * database was seeded from: change prices in the database only once orders are live.
 */

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4300';
const ORDER_ERRORS: OrderErrorCode[] = ['invalid', 'not_found', 'invalid_state'];

/** The API's error shape is `{ error, message }`; order errors come back as `OrderError`, safe to show. */
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}) },
    });
  } catch (err) {
    throw new Error(`The API at ${API} is not answering (${path})`, { cause: err });
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) return body as T;
  const { error, message } = (body ?? {}) as { error?: string; message?: string };
  if (message && ORDER_ERRORS.includes(error as OrderErrorCode)) throw new OrderError(error as OrderErrorCode, message);
  throw new Error(`The API answered ${res.status} for ${path}${message ? `: ${message}` : ''}`);
}

type Catalogue = { categories: OrderCategory[]; products: OrderProduct[] };

/** Cached for a minute; from B4 the API clears it through /revalidate when staff change a product. */
const catalogue = () => call<Catalogue>('/api/catalogue', { next: { revalidate: 60, tags: ['catalogue'] } });

export const liveApi: SiteApi = {
  ...mockApi,

  // B1: catalogue and pricing.
  async listOrderCategories() {
    return (await catalogue()).categories;
  },
  async listOrderProducts() {
    return (await catalogue()).products;
  },
  async getOrderProduct(slug) {
    return (await catalogue()).products.find((p) => p.slug === slug) ?? null;
  },
  async priceEstimate(request) {
    return call<PriceEstimate>('/api/quotes/price', { method: 'POST', body: JSON.stringify(request), cache: 'no-store' });
  },
};
