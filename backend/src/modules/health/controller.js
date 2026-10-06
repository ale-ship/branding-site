// @ts-check
import { healthReport } from './service.js';

/**
 * 200 when everything answers, 503 when degraded, so a deploy can wait for a healthy start.
 * @param {import('./service.js').HealthDeps} deps
 * @returns {import('express').RequestHandler}
 */
export const getHealth = (deps) => async (_req, res) => {
  const report = await healthReport(deps);
  res.status(report.status === 'ok' ? 200 : 503).set('Cache-Control', 'no-store').json(report);
};
