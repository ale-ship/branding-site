import { headers } from 'next/headers';
import type { CapacityCalendar } from '../capacity';
import { mockApi } from './mock';
import { OrderError } from './order-types';
import type { Order, OrderCategory, OrderErrorCode, OrderProduct, PriceEstimate, SiteApi } from './types';

/**
 * SiteApi over HTTP to our backend (docs/BACKEND_RUNBOOK.md, section 12), chosen in index.ts when
 * NEXT_PUBLIC_API_MODE=live. Server side only: pages and server actions call it, the browser never
 * does. Methods move here from the mock one build step at a time; the rest still run on the mock:
 *
 *   B1  the order catalogue and the price (listOrderCategories, listOrderProducts, getOrderProduct,
 *       priceEstimate)
 *   B2  placing and reading orders (createOrder, getOrder by token or order number + phone) and the
 *       capacity calendar (getCapacity)
 *
 * What happens to an order after it is placed (paying, proofs, deliveries, surveys) arrives with B3
 * and B5: until then those methods answer that it isn't available online yet, rather than looking
 * for the order in the mock, which doesn't have it. Accounts stay on the mock until B5, so an order
 * reached through a signed-in account (`{ email }`) isn't found in live mode until then.
 */

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4300';
const ORDER_ERRORS: OrderErrorCode[] = ['invalid', 'not_found', 'invalid_state'];

/**
 * The visitor's address, so the API's per-visitor limits count visitors and not the site's server.
 * nginx appends the address it saw as the last entry of X-Forwarded-For; earlier entries come from
 * the browser and can be anything. Only for calls made for one visitor: reading headers makes a
 * page dynamic, so the catalogue (read when pages are built) never does.
 */
async function visitor(): Promise<Record<string, string>> {
  try {
    const ip = (await headers()).get('x-forwarded-for')?.split(',').at(-1)?.trim();
    return ip ? { 'x-forwarded-for': ip } : {};
  } catch {
    // Outside a request (tests, build): nothing to pass on.
    return {};
  }
}

/** The API's error shape is `{ error, message }`; order errors come back as `OrderError`, safe to show. */
async function call<T>(path: string, init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
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

/** A call made for one visitor: never cached, their address passed on. */
const forVisitor = async <T>(path: string, init: Parameters<typeof call>[1] = {}) =>
  call<T>(path, { ...init, cache: 'no-store', headers: { ...init.headers, ...(await visitor()) } });

type Catalogue = { categories: OrderCategory[]; products: OrderProduct[] };

/** Cached for a minute; from B4 the API clears it through /revalidate when staff change a product. */
const catalogue = () => call<Catalogue>('/api/catalogue', { next: { revalidate: 60, tags: ['catalogue'] } });

/** Null for "no such order, or not yours": the API answers both the same way. */
async function orNull(read: Promise<Order>): Promise<Order | null> {
  try {
    return await read;
  } catch (e) {
    if (e instanceof OrderError && e.code === 'not_found') return null;
    throw e;
  }
}

const notYet = async (): Promise<never> => {
  throw new OrderError('invalid_state', 'This isn’t available online yet. Please WhatsApp us and we’ll sort it out.');
};

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
    return forVisitor<PriceEstimate>('/api/quotes/price', { method: 'POST', body: JSON.stringify(request) });
  },

  // B2: placing and reading orders, and the machine time they hold.
  async getCapacity() {
    return call<CapacityCalendar>('/api/capacity', { cache: 'no-store' });
  },
  async createOrder(input) {
    return forVisitor<{ ref: string; token: string }>('/api/orders', { method: 'POST', body: JSON.stringify(input) });
  },
  async getOrder(ref, access) {
    // The token travels in a header, never in the URL.
    if ('token' in access) {
      if (!access.token) return null;
      return orNull(forVisitor<Order>(`/api/orders/${encodeURIComponent(ref)}`, { headers: { 'x-order-token': access.token } }));
    }
    if ('phone' in access) return orNull(forVisitor<Order>('/api/orders/lookup', { method: 'POST', body: JSON.stringify({ ref, phone: access.phone }) }));
    // `{ email }` comes from a session, and sessions move to the API with accounts (B5).
    return null;
  },

  // B3 and B5: after the order is placed.
  startPayment: notYet,
  approveProof: notYet,
  requestChanges: notYet,
  reviewSample: notYet,
  requestPartialDelivery: notYet,
  bookSurvey: notYet,
  acceptSiteQuote: notYet,
  bookInstall: notYet,
};
