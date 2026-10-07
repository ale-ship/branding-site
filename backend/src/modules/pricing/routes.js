// @ts-check
import { Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit.js';
import { postPrice } from './controller.js';

/**
 * /api/quotes. The price is asked for as the customer types: 120 a minute per IP (section 8.1).
 * @param {{ pool: import('pg').Pool | null; redis: import('ioredis').Redis | null }} deps
 */
export function pricingRoutes(deps) {
  const router = Router();
  router.post('/price', rateLimit(deps.redis, { name: 'price', limit: 120, windowSec: 60 }), postPrice(deps));
  return router;
}
