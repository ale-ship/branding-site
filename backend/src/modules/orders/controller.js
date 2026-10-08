// @ts-check
import { orderInputSchema, orderLookupSchema } from '@noorcom-branding/shared/contract/schemas.js';
import { accessFrom } from '../../middleware/customerAccess.js';
import { createOrder, getOrder } from './service.js';

/**
 * The customer's side of orders. The secret token travels in a header, never in the URL, so it stays
 * out of access logs (section 9). Order answers are never cached.
 * @typedef {import('../../deps.js').Deps} Deps
 */

/** @param {import('express').Response} res */
const noStore = (res) => res.set('Cache-Control', 'no-store');

/**
 * POST /api/orders: an `OrderInput` in; 201 with `{ ref, token }`.
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postOrder = (deps) => async (req, res) => {
  const input = orderInputSchema.parse(req.body);
  noStore(res).status(201).json(await createOrder({ ...deps, logger: req.log }, input));
};

/**
 * GET /api/orders/:no with the secret token in `X-Order-Token` (or the phone in `X-Order-Phone`).
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const getOrderHandler = (deps) => async (req, res) => {
  noStore(res).json(await getOrder({ ...deps, logger: req.log }, String(req.params.no), accessFrom(req)));
};

/**
 * POST /api/orders/lookup: `{ ref, phone }`, the order number and the phone it was placed with.
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postLookup = (deps) => async (req, res) => {
  const { ref, phone } = orderLookupSchema.parse(req.body);
  noStore(res).json(await getOrder({ ...deps, logger: req.log }, ref, { phone }));
};
