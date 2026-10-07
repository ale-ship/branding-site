// @ts-check
import { getCatalogue } from './service.js';

/**
 * GET /api/catalogue: `{ categories, products }`. The site's server reads it (src/lib/api/live.ts);
 * a minute of HTTP caching is harmless because staff changes clear the site's copy through
 * /revalidate (section 12).
 * @param {import('./service.js').CatalogueDeps} deps
 * @returns {import('express').RequestHandler}
 */
export const getCatalogueHandler = (deps) => async (req, res) => {
  const catalogue = await getCatalogue({ ...deps, logger: req.log });
  res.set('Cache-Control', 'public, max-age=60').json(catalogue);
};
