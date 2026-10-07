// @ts-check
import { Router } from 'express';
import { getCatalogueHandler } from './controller.js';

/**
 * /api/catalogue. Only the general per-IP limit applies (app.js): the answer is cached.
 * @param {import('./service.js').CatalogueDeps} deps
 */
export function catalogueRoutes(deps) {
  const router = Router();
  router.get('/', getCatalogueHandler(deps));
  return router;
}
