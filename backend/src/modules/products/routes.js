// @ts-check
import { Router } from 'express';
import { requireRole } from '../../middleware/staffAuth.js';
import { getProducts, patchProduct } from './controller.js';

/**
 * /api/staff/products: every staff member may look; only admins change a minimum (the spec's price
 * manager is the admin's). Behind `requireStaff` (app.js).
 * @param {import('../../deps.js').Deps} deps
 */
export function staffProductRoutes(deps) {
  const router = Router();
  router.get('/products', getProducts(deps));
  router.patch('/products/:slug', requireRole('admin'), patchProduct(deps));
  return router;
}
