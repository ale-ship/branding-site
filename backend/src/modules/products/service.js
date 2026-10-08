// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { AppError } from '../../lib/errors.js';
import { CACHE_KEY } from '../catalogue/service.js';
import { audit } from '../staff/repo.js';
import * as repo from './repo.js';

/**
 * Staff set each quantity-run product's minimum (owner, 8 Oct 2026; the price manager's first part).
 * The default is 10 pieces. A change takes effect at once: the cached catalogue is dropped, so the
 * order form, the price and new orders all use it; orders already placed keep their quantity.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../staff/repo.js').Staff} Staff
 */

export const MAX_MINIMUM = 100_000;

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
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {string} slug
 * @param {number} minimum
 */
export async function setMinimum(deps, staff, slug, minimum) {
  const pool = need(deps);
  if (!Number.isInteger(minimum) || minimum < 1 || minimum > MAX_MINIMUM) {
    throw new OrderError('invalid', `The minimum must be a whole number from 1 to ${MAX_MINIMUM.toLocaleString('en-KE')}.`);
  }
  const changed = await repo.setMinimum(pool, slug, minimum);
  if (!changed) throw new OrderError('not_found', 'There is no such product.');
  await audit(pool, staff.id, 'minimum-changed', null, { product: slug, from: changed.before, to: changed.after });
  // The catalogue is cached for 10 minutes; drop it so the change shows now.
  await deps.redis?.del(CACHE_KEY).catch((err) => deps.logger?.warn({ err }, 'catalogue cache not cleared'));
  deps.logger?.info({ product: slug, from: changed.before, to: changed.after, staff: staff.id }, 'minimum changed');
  return (await listProducts(deps)).find((p) => p.slug === slug);
}
