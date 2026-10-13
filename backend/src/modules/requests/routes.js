// @ts-check
import { Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit.js';
import { getOne, getRequests, patchOne, postMessage, postQuote } from './controller.js';

/**
 * /api/requests: the site's quote and contact forms, 10 an hour per visitor each (section 8.1).
 * @param {import('../../deps.js').Deps & { redis: import('ioredis').Redis | null }} deps
 */
export function requestRoutes(deps) {
  const router = Router();
  router.post('/quote', rateLimit(deps.redis, { name: 'quote', limit: 10, windowSec: 3600 }), postQuote(deps));
  router.post('/contact', rateLimit(deps.redis, { name: 'contact', limit: 10, windowSec: 3600 }), postMessage(deps));
  return router;
}

/**
 * /api/staff/requests: the inbox, for every staff member. Behind `requireStaff` (app.js).
 * @param {import('../../deps.js').Deps} deps
 */
export function staffRequestRoutes(deps) {
  const router = Router();
  router.get('/requests', getRequests(deps));
  router.get('/requests/:ref', getOne(deps));
  router.patch('/requests/:ref', patchOne(deps));
  return router;
}
