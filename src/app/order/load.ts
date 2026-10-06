import { cookies } from 'next/headers';
import { api, type Order, type OrderAccess } from '@/lib/api';
import { accessCookie, parseAccess } from './access';

/**
 * Loads an order for a page: with the secret link's token if there is one, otherwise with what
 * this browser remembers for the order (set when it was placed or found). Null when neither works.
 */
export async function loadOrder(rawRef: string, token: string): Promise<{ order: Order | null; ref: string }> {
  const ref = decodeURIComponent(rawRef).toUpperCase();
  const access: OrderAccess | null = token ? { token } : parseAccess((await cookies()).get(accessCookie(ref))?.value);
  return { order: access ? await api.getOrder(ref, access) : null, ref };
}

/** `?t=` from a page's search params. */
export const tokenFrom = (params: Record<string, string | string[] | undefined>) => (typeof params.t === 'string' ? params.t : '');

/** Keeps the secret link on links between the order's pages. */
export const withToken = (path: string, token: string) => (token ? `${path}?t=${encodeURIComponent(token)}` : path);
