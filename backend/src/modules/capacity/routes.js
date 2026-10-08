// @ts-check
import { Router } from 'express';
import { getCapacityHandler } from './controller.js';

/**
 * /api/capacity. Only the general per-IP limit applies (app.js).
 * @param {{ pool: import('pg').Pool | null }} deps
 */
export function capacityRoutes(deps) {
  const router = Router();
  router.get('/', getCapacityHandler(deps));
  return router;
}
