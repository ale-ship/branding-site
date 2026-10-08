// @ts-check
import { Router } from 'express';
import { requireRole } from '../../middleware/staffAuth.js';
import { getAccounts, getReport, getStatement } from './controller.js';

/**
 * /api/staff/reports and /api/staff/accounts: the money side, for the admin only (owner, 8 Oct
 * 2026). Mounted behind `requireStaff` (app.js).
 * @param {import('../../deps.js').Deps} deps
 */
export function staffReportRoutes(deps) {
  const router = Router();
  router.get('/reports/:kind', requireRole('admin'), getReport(deps));
  router.get('/accounts', requireRole('admin'), getAccounts(deps));
  router.get('/accounts/statement', requireRole('admin'), getStatement(deps));
  return router;
}
