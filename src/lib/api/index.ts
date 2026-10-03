import { mockApi } from './mock';
import type { SiteApi } from './types';

/**
 * The one way pages get data. Only the mock exists for now (no backend in scope); our own API
 * will implement SiteApi later and be selected here.
 */
export const api: SiteApi = mockApi;

export type * from './types';
