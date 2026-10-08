// @ts-check
import { Router } from 'express';
import { requireRole } from '../../middleware/staffAuth.js';
import * as c from './controller.js';

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

  router.get('/payments/unmatched', requireRole('designer'), c.getUnmatched(deps));
  router.post('/payments/unmatched/:id/assign', requireRole('designer'), c.postAssign(deps));
  router.post('/payments/unmatched/:id/refund', requireRole('designer'), c.postRefund(deps));
  return router;
}
