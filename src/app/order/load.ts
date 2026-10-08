import { cookies } from 'next/headers';
import { api, type Order, type OrderAccess } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/account';
import { accessCookie, parseAccess } from './access';

/**
 * Loads an order for a page: with the secret link's token if there is one, otherwise with what
 * this browser remembers for the order (set when it was placed or found), otherwise the signed-in
 * account's verified email. Null when none works.
 */
export async function loadOrder(rawRef: string, token: string): Promise<{ order: Order | null; ref: string }> {
  const ref = decodeURIComponent(rawRef).toUpperCase();
  const jar = await cookies();
  let access: OrderAccess | null = token ? { token } : parseAccess(jar.get(accessCookie(ref))?.value);
  let order = access ? await api.getOrder(ref, access) : null;
  if (!order) {
    const session = jar.get(SESSION_COOKIE)?.value;
    const account = session ? await api.getAccount(session) : null;
    access = account ? { email: account.email } : null;
    order = access ? await api.getOrder(ref, access) : null;
  }
  return { order, ref };
}

/** `?t=` from a page's search params. */
export const tokenFrom = (params: Record<string, string | string[] | undefined>) => (typeof params.t === 'string' ? params.t : '');

/** Keeps the secret link on links between the order's pages. */
export const withToken = (path: string, token: string) => (token ? `${path}?t=${encodeURIComponent(token)}` : path);
