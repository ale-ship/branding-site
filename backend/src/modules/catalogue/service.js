// @ts-check
import { AppError } from '../../lib/errors.js';
import { key } from '../../redis.js';
import { listCategories, listProducts } from './repo.js';

/**
 * The order catalogue (docs/BACKEND_RUNBOOK.md, step B1): what `GET /api/catalogue` answers and what
 * the price rules read. Cached in Redis for 10 minutes (`nb:cache:catalogue`, section 2.2); the back
 * office deletes the key when staff change a product (B4). Redis is a cache only: when it is down or
 * not configured, the catalogue comes straight from Postgres.
 *
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderCategory} OrderCategory
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderProduct} OrderProduct
 * @typedef {{ categories: OrderCategory[]; products: OrderProduct[] }} Catalogue
 *
 * @typedef {object} CatalogueDeps
 * @property {import('pg').Pool | null} pool
 * @property {Pick<import('ioredis').Redis, 'get' | 'set'> | null} redis
 * @property {import('../../lib/logger.js').Logger} [logger]
 */

export const CACHE_KEY = key('cache', 'catalogue');
const CACHE_SECONDS = 600;

/**
 * @param {CatalogueDeps} deps
 * @returns {Promise<Catalogue>}
 */
export async function getCatalogue({ pool, redis, logger }) {
  if (!pool) throw new AppError(503, 'unavailable', 'Ordering is unavailable for a moment. Please try again shortly.');
  const cached = await redis?.get(CACHE_KEY).catch((err) => logger?.warn({ err }, 'catalogue cache unavailable'));
  if (cached) return JSON.parse(cached);
  const [categories, products] = await Promise.all([listCategories(pool), listProducts(pool)]);
  const catalogue = { categories, products };
  await redis?.set(CACHE_KEY, JSON.stringify(catalogue), 'EX', CACHE_SECONDS).catch((err) => logger?.warn({ err }, 'catalogue cache unavailable'));
  return catalogue;
}

/**
 * One product by slug, or null.
 * @param {CatalogueDeps} deps
 * @param {string} slug
 * @returns {Promise<OrderProduct | null>}
 */
export async function getProduct(deps, slug) {
  const { products } = await getCatalogue(deps);
  return products.find((p) => p.slug === slug) ?? null;
}
