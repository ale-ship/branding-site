import { describe, expect, it } from 'vitest';
import { mockApi } from './api/mock';
import { categoryCounts, categoryLabel, clampQuantity, parseCategory, relatedProducts, shopHref } from './shop';

const products = await mockApi.listProducts();

describe('shop helpers', () => {
  it('parses categories', () => {
    expect(parseCategory('gifts')).toBe('gifts');
    expect(parseCategory(['apparel', 'gifts'])).toBe('apparel');
    expect(parseCategory('rockets')).toBeUndefined();
    expect(parseCategory(undefined)).toBeUndefined();
  });

  it('labels and links categories', () => {
    expect(categoryLabel('display')).toBe('Display');
    expect(shopHref()).toBe('/shop');
    expect(shopHref('print')).toBe('/shop?category=print');
  });

  it('counts only categories with products, and the counts add up', () => {
    const counts = categoryCounts(products);
    expect(counts.every((c) => c.count > 0)).toBe(true);
    expect(counts.reduce((s, c) => s + c.count, 0)).toBe(products.length);
  });

  it('suggests same-category products first and never the product itself', () => {
    const mug = products.find((p) => p.slug === 'mug-branding')!;
    const related = relatedProducts(mug, products);
    expect(related).toHaveLength(4);
    expect(related.some((p) => p.slug === mug.slug)).toBe(false);
    expect(related[0]!.category).toBe('gifts');
  });

  it('clamps quantities', () => {
    expect(clampQuantity(10, 50, 1000)).toBe(50);
    expect(clampQuantity(120.6, 50, 1000)).toBe(121);
    expect(clampQuantity(5000, 50, 1000)).toBe(1000);
    expect(clampQuantity(Number.NaN, 50, 1000)).toBe(50);
  });
});
