import { liveApi } from './live';
import { mockApi } from './mock';
import { mockStaff } from './mock-orders';
import type { SiteApi } from './types';

/**
 * The one way pages get data. `NEXT_PUBLIC_API_MODE=live` serves what our backend already does from
 * it (live.ts: the catalogue and the price, orders, payments, proofs, the site's content and accounts) and everything
 * else from the mock; unset or `mock`, everything is the mock. Read at build time, like every NEXT_PUBLIC_ setting.
 */
export const api: SiteApi = process.env.NEXT_PUBLIC_API_MODE === 'live' ? liveApi : mockApi;

/**
 * Whether accounts run on the mock or on our backend (live mode, from step B5). The sign-in demo
 * code exists only while they are mocked. (Orders and payments follow `ordersOnApi`.)
 */
export const apiMode: 'mock' | 'live' = process.env.NEXT_PUBLIC_API_MODE === 'live' ? 'live' : 'mock';

/**
 * Whether orders are placed and read on our backend (live mode, from B2). The order page's demo
 * controls work on the mock's orders, so they are off then.
 */
export const ordersOnApi = process.env.NEXT_PUBLIC_API_MODE === 'live';

/**
 * Mock only: what staff and M-Pesa would do (Paybill payment, upload a proof, log production),
 * so the order flow can be tried end to end. Null once a real backend is in.
 */
export const demo = apiMode === 'mock' && !ordersOnApi ? mockStaff : null;

export type * from './types';
export { OrderError } from './order-types';
