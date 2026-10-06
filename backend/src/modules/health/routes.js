// @ts-check
import { Router } from 'express';
import { getHealth } from './controller.js';

/**
 * GET /api/health. Not rate limited: the deploy script and monitoring poll it.
 * @param {import('./service.js').HealthDeps} deps
 */
export function healthRoutes(deps) {
  const router = Router();
  router.get('/', getHealth(deps));
  return router;
}
