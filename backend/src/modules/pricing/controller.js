// @ts-check
import { priceRequestSchema } from '@noorcom-branding/shared/contract/schemas.js';
import { priceQuote } from './service.js';

/**
 * POST /api/quotes/price: a `PriceRequest` in, a `PriceEstimate` out. A body that doesn't match the
 * schema is a 400 with the fields at fault (lib/errors.js).
 * @param {import('../catalogue/service.js').CatalogueDeps} deps
 * @returns {import('express').RequestHandler}
 */
export const postPrice = (deps) => async (req, res) => {
  const request = priceRequestSchema.parse(req.body);
  res.set('Cache-Control', 'no-store').json(await priceQuote({ ...deps, logger: req.log }, request));
};
