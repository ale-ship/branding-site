import { mockApi } from './mock';
import { mockStaff } from './mock-orders';
import type { SiteApi } from './types';

/**
 * The one way pages get data. Only the mock exists for now (no backend in scope); our own API
 * will implement SiteApi later and be selected here.
 */
export const api: SiteApi = mockApi;

/** Which implementation is serving `api`. The order tracker's demo controls exist only in mock mode. */
export const apiMode: 'mock' | 'live' = 'mock';

/**
 * Mock only: what staff and M-Pesa would do (Paybill payment, upload a proof, log production),
 * so the order flow can be tried end to end. Null once a real backend is in.
 */
export const demo = apiMode === 'mock' ? mockStaff : null;

export type * from './types';
export { OrderError } from './order-types';
