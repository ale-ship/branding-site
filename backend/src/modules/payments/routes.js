// @ts-check
import { Router } from 'express';
import { providerGuard } from '../../middleware/providerGuard.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { postC2BConfirmation, postC2BValidation, postDevC2B, postStk, postStkCallback } from './controller.js';

/**
 * @typedef {import('../../deps.js').Deps & { redis: import('ioredis').Redis | null }} Deps
 */

/**
 * /api/payments: the customer's M-Pesa prompt (10 per 10 minutes, section 8.1).
 * @param {Deps} deps
 */
export function paymentRoutes(deps) {
  const router = Router();
  router.post('/stk', rateLimit(deps.redis, { name: 'stk', limit: 10, windowSec: 600 }), postStk(deps));
  return router;
}

/**
 * /api/payments/absa: Absa's callbacks, behind the secret path segment. Not rate limited (section
 * 8.1): mounted before the general limit, and nginx lets only Absa's addresses reach them.
 * @param {Deps} deps
 * @param {string} secret
 */
export function absaCallbackRoutes(deps, secret) {
  const router = Router();
  const guard = providerGuard(secret);
  router.post('/stk/:secret', guard, postStkCallback(deps));
  router.post('/c2b/confirm/:secret', guard, postC2BConfirmation(deps));
  router.post('/c2b/validate/:secret', guard, postC2BValidation);
  return router;
}

/**
 * /api/dev: tools for the fakes, mounted only when Absa is fake and not in production.
 * @param {Deps} deps
 */
export function devRoutes(deps) {
  const router = Router();
  router.post('/c2b', postDevC2B(deps));
  return router;
}
