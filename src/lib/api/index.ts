import { liveApi } from './live';
import { mockApi } from './mock';
import { mockStaff } from './mock-orders';
import type { SiteApi } from './types';

/**
 * The one way pages get data. `NEXT_PUBLIC_API_MODE=live` serves what our backend already does from
 * it (live.ts; step B1: the order catalogue and the price) and everything else from the mock; unset
 * or `mock`, everything is the mock. Read at build time, like every NEXT_PUBLIC_ setting.
 */
export const api: SiteApi = process.env.NEXT_PUBLIC_API_MODE === 'live' ? liveApi : mockApi;

/**
 * Whether orders, payments and accounts run on the mock. They still do in live mode until steps B2
 * and B3 move them to the backend; the demo controls and the sign-in demo code exist only while
 * they are mocked.
 */
export const apiMode: 'mock' | 'live' = 'mock';

/**
 * Mock only: what staff and M-Pesa would do (Paybill payment, upload a proof, log production),
 * so the order flow can be tried end to end. Null once a real backend is in.
 */
export const demo = apiMode === 'mock' ? mockStaff : null;

export type * from './types';
export { OrderError } from './order-types';
