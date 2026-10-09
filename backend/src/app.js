// @ts-check
import express, { Router } from 'express';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { rateLimit } from './middleware/rateLimit.js';
import { requestContext } from './middleware/requestId.js';
import { requireStaff } from './middleware/staffAuth.js';
import { backofficeRoutes } from './modules/backoffice/routes.js';
import { capacityRoutes } from './modules/capacity/routes.js';
import { catalogueRoutes } from './modules/catalogue/routes.js';
import { contentRoutes, mediaRoutes, staffContentRoutes } from './modules/content/routes.js';
import { fileRoutes } from './modules/files/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { orderRoutes } from './modules/orders/routes.js';
import { absaCallbackRoutes, devRoutes, paymentRoutes } from './modules/payments/routes.js';
import { pricingRoutes } from './modules/pricing/routes.js';
import { staffProductRoutes } from './modules/products/routes.js';
import { proofRoutes, staffProofRoutes } from './modules/proofs/routes.js';
import { staffReportRoutes } from './modules/reports/routes.js';
import { staffAuthRoutes, staffRoutes } from './modules/staff/routes.js';

/**
 * @typedef {import('./deps.js').Deps & {
 *   logger: import('./lib/logger.js').Logger;
 *   redis: import('ioredis').Redis | null;
 *   limits?: { api?: { limit?: number; windowSec?: number } };
 * }} AppDeps
 */

/**
 * The Express app, without listening: tests drive it with supertest. Middleware in order: request id
 * and logger, JSON body (small), health, Absa's callbacks (never rate limited), the general per-IP
 * limit, the modules, then 404 and the error handler (docs/BACKEND_RUNBOOK.md, section 4).
 * @param {import('./config.js').Config} config
 * @param {AppDeps} deps
 */
export function createApp(config, { limits = {}, ...deps }) {
  const { logger, pool, redis } = deps;
  const all = { ...deps, config };
  const app = express();
  app.disable('x-powered-by');
  // Only nginx and the site, on this machine, talk to the API.
  app.set('trust proxy', 'loopback');

  app.use(requestContext(logger));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRoutes({ pool, redis, build: config.build, integrations: config.integrations }));
  app.use('/api/payments/absa', absaCallbackRoutes(all, config.absa.secret));
  app.use('/api/media', mediaRoutes(all));

  // Everything else under /api: a general per-IP ceiling (routes add their own, section 8.1).
  app.use('/api', rateLimit(redis, { name: 'api', limit: 300, windowSec: 60, ...limits.api }));

  // The modules (docs/BACKEND_RUNBOOK.md, section 13): B1 catalogue and pricing; B2 orders and the
  // capacity calendar; B3 payments; B4 the back office, with the admin's reports and customer accounts, and the website editor.
  app.use('/api/catalogue', catalogueRoutes({ pool, redis }));
  app.use('/api/content', contentRoutes(all));
  app.use('/api/quotes', pricingRoutes({ pool, redis }));
  app.use('/api/capacity', capacityRoutes({ pool }));
  app.use('/api/orders', orderRoutes(all), proofRoutes(all));
  app.use('/api/files', fileRoutes(all));
  app.use('/api/payments', paymentRoutes(all));
  // B4: the back office. Sign-in is open; everything else needs a staff session (checked once).
  app.use('/api/staff/auth', staffAuthRoutes(all));
  const staff = Router();
  staff.use(requireStaff(all), staffRoutes(all), backofficeRoutes(all), staffProofRoutes(all), staffProductRoutes(all), staffReportRoutes(all), staffContentRoutes(all));
  app.use('/api/staff', staff);
  // A made-up Paybill payment, for trying the flow: only while Absa is fake, never in production.
  if (config.integrations.absa === 'fake' && config.env !== 'production') app.use('/api/dev', devRoutes(all));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
