// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { estimatePrice } from '@noorcom-branding/shared/rules/pricing.js';
import { getProduct } from '../catalogue/service.js';

/**
 * The live price (docs/BACKEND_RUNBOOK.md, step B1): the same `estimatePrice` the order form runs in
 * the browser, against the database's product. Only the server's price counts; from B2,
 * `POST /api/orders` prices through here before it opens an order.
 *
 * The capacity calendar is empty until orders book machine time (B2): until then every deadline the
 * product allows is offered. TODO(B2): read the bookings from `capacity_bookings`.
 *
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').PriceRequest} PriceRequest
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').PriceEstimate} PriceEstimate
 */

/**
 * @param {import('../catalogue/service.js').CatalogueDeps} deps
 * @param {PriceRequest} request
 * @param {string} [today] YYYY-MM-DD in Nairobi; tests pin it
 * @returns {Promise<PriceEstimate>}
 */
export async function priceQuote(deps, request, today = nairobiToday()) {
  const product = await getProduct(deps, request.product);
  if (!product) throw new OrderError('invalid', 'That item can’t be ordered online.');
  if (product.mechanism === 'A' && request.quantity < product.minQuantity) {
    throw new OrderError('invalid', `The smallest order is ${product.minQuantity.toLocaleString('en-KE')} pieces.`);
  }
  return estimatePrice(product, request, today, {});
}
