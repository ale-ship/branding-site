// @ts-check
import express, { Router } from 'express';
import { requireRole } from '../../middleware/staffAuth.js';
import * as c from './controller.js';
import * as x from './extras.controller.js';

/** The sample's photo, and a design's final files (any type: PDF, AI, ZIP…). */
const IMAGE = express.raw({ type: ['image/png', 'image/jpeg'], limit: '10mb' });
const ANY_FILE = express.raw({ type: () => true, limit: '50mb' });

/**
 * /api/staff/orders and /api/staff/payments. Two roles (owner, 8 Oct 2026): the admin, and the
 * designers, who run the front desk, production and handover as well as design, so every step here
 * is theirs (and the admin's). Mounted behind `requireStaff` (app.js).
 * @param {import('../../deps.js').Deps} deps
 */
export function backofficeRoutes(deps) {
  const router = Router();
  router.get('/dashboard', c.getDashboard(deps));
  router.get('/orders', c.getBoard(deps));
  router.get('/orders/:no', c.getOrder(deps));
  router.post('/orders/:no/progress', requireRole('designer'), c.postProgress(deps));
  router.post('/orders/:no/ready', requireRole('designer'), c.postReady(deps));
  router.post('/orders/:no/dispatch', requireRole('designer'), c.postDispatch(deps));
  router.post('/orders/:no/handover', requireRole('designer'), c.postHandOver(deps));
  router.post('/orders/:no/cancel', requireRole('designer'), c.postCancel(deps));
  router.post('/orders/:no/attention/clear', requireRole('designer'), c.postClearAttention(deps));
  // B5: the sample, early deliveries, site jobs and a design's final files.
  router.post('/orders/:no/sample', requireRole('designer'), IMAGE, x.postSample(deps));
  router.post('/orders/:no/early-delivery', requireRole('designer'), x.postEarlyDelivery(deps));
  router.post('/orders/:no/site-quote', requireRole('designer'), x.postSiteQuote(deps));
  router.post('/orders/:no/stage', requireRole('designer'), x.postStage(deps));
  router.post('/orders/:no/finals', requireRole('designer'), ANY_FILE, x.postFinal(deps));
  router.delete('/orders/:no/finals/:id', requireRole('designer'), x.deleteFinal(deps));
  router.post('/orders/:no/finals/send', requireRole('designer'), x.postSendFinals(deps));

  router.get('/payments/unmatched', requireRole('designer'), c.getUnmatched(deps));
  router.post('/payments/unmatched/:id/assign', requireRole('designer'), c.postAssign(deps));
  router.post('/payments/unmatched/:id/refund', requireRole('designer'), c.postRefund(deps));
  return router;
}
