import type { Product, ProductCategory } from './api/types';

/** Shop categories in display order, with their labels. */
export const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'stationery', label: 'Stationery' },
  { value: 'print', label: 'Print' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'gifts', label: 'Gifts' },
  { value: 'display', label: 'Display' },
];

export const categoryLabel = (value: ProductCategory) => CATEGORIES.find((c) => c.value === value)?.label ?? value;

export const productHref = (slug: string) => `/shop/${slug}`;

export const shopHref = (category?: ProductCategory) => (category ? `/shop?category=${category}` : '/shop');

/** The category from `?category=`, or undefined when missing or unknown. */
export function parseCategory(value: string | string[] | undefined): ProductCategory | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return CATEGORIES.find((c) => c.value === v)?.value;
}

/** Categories that have products, with counts, in display order. */
export function categoryCounts(products: Product[]): { value: ProductCategory; label: string; count: number }[] {
  return CATEGORIES.map((c) => ({ ...c, count: products.filter((p) => p.category === c.value).length })).filter((c) => c.count > 0);
}

/** Other products for a product page: same category first, then featured, up to `limit`. */
export function relatedProducts(product: Product, products: Product[], limit = 4): Product[] {
  const others = products.filter((p) => p.slug !== product.slug);
  const score = (p: Product) => (p.category === product.category ? 2 : 0) + (p.featured ? 1 : 0);
  return [...others].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

/** A sensible quantity from the box: whole, at least the minimum, at most `max`. */
export function clampQuantity(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
