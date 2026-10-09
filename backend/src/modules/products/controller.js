// @ts-check
import { z } from 'zod';
import { staffOf } from '../../middleware/staffAuth.js';
import { listProducts, MAX_MINIMUM, MAX_TIERS, updateProduct } from './service.js';

/**
 * /api/staff/products: the quantity-run products, their minimums, prices and whether they are on sale.
 * @typedef {import('../../deps.js').Deps} Deps
 */

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const changeBody = z
  .object({
    minQuantity: z.number().int().min(1).max(MAX_MINIMUM).optional(),
    tiers: z
      .array(z.object({ minQty: z.number().int().min(1).max(MAX_MINIMUM), unitPrice: z.number().int().min(1).max(10_000_000) }))
      .min(1)
      .max(MAX_TIERS)
      .optional(),
    active: z.boolean().optional(),
  })
  .refine((b) => b.minQuantity !== undefined || b.tiers !== undefined || b.active !== undefined, 'Nothing to change.');

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getProducts = (deps) => async (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ products: await listProducts(deps) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const patchProduct = (deps) => async (req, res) => {
  const change = changeBody.parse(req.body);
  res.set('Cache-Control', 'no-store').json({ product: await updateProduct({ ...deps, logger: req.log }, staffOf(req), slug.parse(req.params.slug), change) });
};
