// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { CACHE_KEY } from '../catalogue/service.js';
import { changed as contentChanged } from '../content/service.js';
import { audit } from '../staff/repo.js';
import * as repo from './repo.js';

/**
 * The price manager (owner, 8 Oct 2026): for each quantity-run product, its minimum (10 pieces
 * unless set), its price per piece at each quantity, and whether it is on sale. A change takes
 * effect at once: the cached catalogue is dropped and the site told to refresh, so the order form,
 * the price, the shop and new orders all use it; orders already placed keep their price.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../staff/repo.js').Staff} Staff
 * @typedef {{ minQty: number; unitPrice: number }} Tier
 */

export const MAX_MINIMUM = 100_000;
export const MAX_TIERS = 8;

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'The back office is unavailable for a moment.');
  return deps.pool;
}

/**
 * @param {Deps} deps
 */
export async function listProducts(deps) {
  const rows = await repo.listRunProducts(need(deps));
  return rows.map((r) => ({ slug: r.slug, name: r.name, category: r.category, minQuantity: r.min_qty, active: r.active, tiers: r.tiers }));
}

/**
 * Tiers that price every quantity from the minimum up: each starts above the one before, every price
 * is above zero, and the first starts at or below the minimum.
 * @param {Tier[]} tiers
 * @param {number} minimum
 */
function checkTiers(tiers, minimum) {
  if (!tiers.length || tiers.length > MAX_TIERS) throw new OrderError('invalid', `Give between 1 and ${MAX_TIERS} prices.`);
  for (const [i, t] of tiers.entries()) {
    if (!Number.isInteger(t.minQty) || t.minQty < 1 || t.minQty > MAX_MINIMUM) throw new OrderError('invalid', 'Each price starts at a whole number of pieces.');
    if (!Number.isInteger(t.unitPrice) || t.unitPrice < 1 || t.unitPrice > 10_000_000) throw new OrderError('invalid', 'Each price is a whole number of shillings above 0.');
    const before = tiers[i - 1];
    if (before && t.minQty <= before.minQty) throw new OrderError('invalid', 'Each price starts at more pieces than the one before it.');
  }
  if (/** @type {Tier} */ (tiers[0]).minQty > minimum) {
    throw new OrderError('invalid', `The first price must start at ${minimum.toLocaleString('en-KE')} pieces or fewer, so the minimum order has a price.`);
  }
}

/**
 * Changes a product's minimum, prices or whether it is on sale.
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {string} slug
 * @param {{ minQuantity?: number; tiers?: Tier[]; active?: boolean }} change
 */
export async function updateProduct(deps, staff, slug, change) {
  const pool = need(deps);
  const { minQuantity, tiers, active } = change;
  if (minQuantity !== undefined && (!Number.isInteger(minQuantity) || minQuantity < 1 || minQuantity > MAX_MINIMUM)) {
    throw new OrderError('invalid', `The minimum must be a whole number from 1 to ${MAX_MINIMUM.toLocaleString('en-KE')}.`);
  }
  await withTransaction(pool, async (t) => {
    const p = await repo.lockRunProduct(t, slug);
    if (!p) throw new OrderError('not_found', 'There is no such product.');
    const min = minQuantity ?? p.min_qty;
    const next = tiers ? [...tiers].sort((a, b) => a.minQty - b.minQty) : p.tiers;
    checkTiers(next, min);
    await repo.setRunFields(t, p.id, { minQty: min, active: active ?? p.active });
    if (tiers) await repo.setTiers(t, p.id, next);
    if (min !== p.min_qty) await audit(t, staff.id, 'minimum-changed', null, { product: slug, from: p.min_qty, to: min });
    if (tiers && JSON.stringify(next) !== JSON.stringify(p.tiers)) await audit(t, staff.id, 'prices-changed', null, { product: slug, from: p.tiers, to: next });
    if (active !== undefined && active !== p.active) await audit(t, staff.id, active ? 'product-on-sale' : 'product-off-sale', null, { product: slug });
  });
  // The catalogue is cached for 10 minutes; drop it so the change shows now, and refresh the site.
  await deps.redis?.del(CACHE_KEY).catch((err) => deps.logger?.warn({ err }, 'catalogue cache not cleared'));
  await contentChanged(deps, ['catalogue', 'content']);
  deps.logger?.info({ product: slug, staff: staff.id, ...change }, 'product changed');
  return (await listProducts(deps)).find((p) => p.slug === slug);
}
