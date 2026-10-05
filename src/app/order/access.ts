import type { OrderAccess } from '@/lib/api';

/** The cookie that remembers, in this browser, how a visitor opened an order. */
export const accessCookie = (ref: string) => `nb-order-${ref.replace(/[^A-Z0-9-]/gi, '')}`;

/** Reads that cookie's value back: `t:<token>` or `p:<phone>`. */
export function parseAccess(value: string | undefined): OrderAccess | null {
  if (!value) return null;
  if (value.startsWith('t:') && value.length > 2) return { token: value.slice(2) };
  if (value.startsWith('p:') && value.length > 2) return { phone: value.slice(2) };
  return null;
}
