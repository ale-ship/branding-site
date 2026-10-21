// @ts-check
import { Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit.js';
import { getOrderHandler, postAcceptQuote, postEarlyDelivery, postInstall, postLookup, postOrder, postPaymentReport, postSampleReview, postSurvey } from './controller.js';

/**
 * /api/orders, with the limits in section 8.1 (per visitor: the site passes their address along).
 * @param {import('../../deps.js').Deps & { redis: import('ioredis').Redis | null }} deps
 */
export function orderRoutes(deps) {
  const router = Router();
  router.post('/', rateLimit(deps.redis, { name: 'orders', limit: 20, windowSec: 600 }), postOrder(deps));
  router.post('/lookup', rateLimit(deps.redis, { name: 'lookup', limit: 30, windowSec: 600 }), postLookup(deps));
  router.get('/:no', rateLimit(deps.redis, { name: 'order', limit: 120, windowSec: 60 }), getOrderHandler(deps));
  // B5: the sample, early deliveries and a site job's survey, quote and installation.
  const steps = rateLimit(deps.redis, { name: 'order-step', limit: 30, windowSec: 600 });
  router.post('/:no/sample', steps, postSampleReview(deps));
  router.post('/:no/deliveries', steps, postEarlyDelivery(deps));
  router.post('/:no/survey', steps, postSurvey(deps));
  router.post('/:no/quote/accept', steps, postAcceptQuote(deps));
  router.post('/:no/install', steps, postInstall(deps));
  // Payments by hand: the customer's M-Pesa code, for staff to check and record.
  router.post('/:no/payment-report', steps, postPaymentReport(deps));
  return router;
}
