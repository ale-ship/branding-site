// @ts-check
import { Router } from 'express';
import { requireRole } from '../../middleware/staffAuth.js';
import * as c from './controller.js';

/**
 * /api/staff/orders and /api/staff/payments, by role (docs/ORDER_WORKFLOW_SPEC.md, "Staff
 * dashboard": admin everything; sales handles orders, pickups and payments; production logs work;
 * installers and riders hand over). Mounted behind `requireStaff` (app.js).
 * @param {import('../../deps.js').Deps} deps
 */
export function backofficeRoutes(deps) {
  const router = Router();
  router.get('/orders', c.getBoard(deps));
  router.get('/orders/:no', c.getOrder(deps));
  router.post('/orders/:no/progress', requireRole('production'), c.postProgress(deps));
  router.post('/orders/:no/ready', requireRole('production', 'sales'), c.postReady(deps));
  router.post('/orders/:no/dispatch', requireRole('sales', 'installer'), c.postDispatch(deps));
  router.post('/orders/:no/handover', requireRole('sales', 'installer'), c.postHandOver(deps));
  router.post('/orders/:no/cancel', requireRole('sales'), c.postCancel(deps));
  router.post('/orders/:no/attention/clear', requireRole('sales'), c.postClearAttention(deps));

  router.get('/payments/unmatched', requireRole('sales'), c.getUnmatched(deps));
  router.post('/payments/unmatched/:id/assign', requireRole('sales'), c.postAssign(deps));
  router.post('/payments/unmatched/:id/refund', requireRole('sales'), c.postRefund(deps));
  return router;
}
