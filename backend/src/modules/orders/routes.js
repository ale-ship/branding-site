// @ts-check
import { Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit.js';
import { getOrderHandler, postLookup, postOrder } from './controller.js';

/**
 * /api/orders, with the limits in section 8.1 (per visitor: the site passes their address along).
 * @param {import('../../deps.js').Deps & { redis: import('ioredis').Redis | null }} deps
 */
export function orderRoutes(deps) {
  const router = Router();
  router.post('/', rateLimit(deps.redis, { name: 'orders', limit: 20, windowSec: 600 }), postOrder(deps));
  router.post('/lookup', rateLimit(deps.redis, { name: 'lookup', limit: 30, windowSec: 600 }), postLookup(deps));
  router.get('/:no', rateLimit(deps.redis, { name: 'order', limit: 120, windowSec: 60 }), getOrderHandler(deps));
  return router;
}
