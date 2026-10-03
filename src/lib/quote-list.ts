import type { Product, QuoteItem } from './api/types';

/**
 * The quote list: shop items the customer is collecting before sending /quote. Pure functions
 * here (tested in quote-list.test.ts); the browser storage hook is in
 * components/shop/useQuoteList.ts.
 */

export const QUOTE_LIST_KEY = 'noorcom-branding.quote-list.v1';
export const QUOTE_LIST_MAX = 20;
export const QUANTITY_MAX = 100_000;

/** The same product with the same options is one line. */
export function itemKey(item: Pick<QuoteItem, 'slug' | 'options'>): string {
  const options = Object.keys(item.options)
    .sort()
    .map((k) => `${k}=${item.options[k]}`)
    .join('&');
  return `${item.slug}?${options}`;
}

/** Adds a line, or sets the quantity of the matching line. Ignores additions past the cap. */
export function addItem(list: QuoteItem[], item: QuoteItem): QuoteItem[] {
  const key = itemKey(item);
  if (list.some((i) => itemKey(i) === key)) {
    return list.map((i) => (itemKey(i) === key ? { ...i, quantity: item.quantity } : i));
  }
  return list.length >= QUOTE_LIST_MAX ? list : [...list, item];
}

export function setQuantity(list: QuoteItem[], key: string, quantity: number): QuoteItem[] {
  return list.map((i) => (itemKey(i) === key ? { ...i, quantity } : i));
}

export function removeItem(list: QuoteItem[], key: string): QuoteItem[] {
  return list.filter((i) => itemKey(i) !== key);
}

/** Reads what the browser stored. Anything malformed is dropped rather than trusted. */
export function parseList(raw: string | null): QuoteItem[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const items: QuoteItem[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const { slug, quantity, options } = entry as Record<string, unknown>;
    if (typeof slug !== 'string' || !slug || slug.length > 80) continue;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > QUANTITY_MAX) continue;
    const opts: Record<string, string> = {};
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      for (const [k, v] of Object.entries(options as Record<string, unknown>).slice(0, 10)) {
        if (typeof v === 'string') opts[k.slice(0, 40)] = v.slice(0, 80);
      }
    }
    items.push({ slug, quantity, options: opts });
    if (items.length === QUOTE_LIST_MAX) break;
  }
  return items;
}

/** Total of price × quantity for the items whose product is known. */
export function estimateTotal(list: QuoteItem[], catalogue: Pick<Product, 'slug' | 'pricePerPiece'>[]): number {
  const price = new Map(catalogue.map((p) => [p.slug, p.pricePerPiece]));
  return list.reduce((sum, i) => sum + (price.get(i.slug) ?? 0) * i.quantity, 0);
}

/** Total pieces across the list. */
export function totalPieces(list: QuoteItem[]): number {
  return list.reduce((sum, i) => sum + i.quantity, 0);
}

/** The default option values for a product: the first of each. */
export function defaultOptions(product: Pick<Product, 'options'>): Record<string, string> {
  return Object.fromEntries(product.options.map((o) => [o.name, o.values[0] ?? '']));
}

/** `Finish: Matte laminate · Sides: Both sides` */
export function describeOptions(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}
