// @ts-check
import { z } from 'zod';
import { staffOf } from '../../middleware/staffAuth.js';
import { listProducts, MAX_MINIMUM, setMinimum } from './service.js';

/**
 * /api/staff/products: the quantity-run products and their minimums.
 * @typedef {import('../../deps.js').Deps} Deps
 */

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const minimumBody = z.object({ minQuantity: z.number().int().min(1).max(MAX_MINIMUM) });

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getProducts = (deps) => async (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ products: await listProducts(deps) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const patchMinimum = (deps) => async (req, res) => {
  const { minQuantity } = minimumBody.parse(req.body);
  res.set('Cache-Control', 'no-store').json({ product: await setMinimum({ ...deps, logger: req.log }, staffOf(req), slug.parse(req.params.slug), minQuantity) });
};
