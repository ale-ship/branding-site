// @ts-check
import express from 'express';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { rateLimit } from './middleware/rateLimit.js';
import { requestContext } from './middleware/requestId.js';
import { healthRoutes } from './modules/health/routes.js';

/**
 * @typedef {object} AppDeps
 * @property {import('./lib/logger.js').Logger} logger
 * @property {import('pg').Pool | null} pool Null in development without DATABASE_URL.
 * @property {import('ioredis').Redis | null} redis Null in development without REDIS_URL.
 * @property {{ api?: { limit?: number; windowSec?: number } }} [limits]
 */

/**
 * The Express app, without listening: tests drive it with supertest. Middleware in order: request id
 * and logger, JSON body (small), health, the general per-IP limit, the modules, then 404 and the error
 * handler (docs/BACKEND_RUNBOOK.md, section 4).
 * @param {import('./config.js').Config} config
 * @param {AppDeps} deps
 */
export function createApp(config, { logger, pool, redis, limits = {} }) {
  const app = express();
  app.disable('x-powered-by');
  // Only nginx and the site, on this machine, talk to the API.
  app.set('trust proxy', 'loopback');

  app.use(requestContext(logger));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRoutes({ pool, redis, build: config.build, integrations: config.integrations }));

  // Everything else under /api: a general per-IP ceiling (routes add their own, section 8.1).
  app.use('/api', rateLimit(redis, { name: 'api', limit: 300, windowSec: 60, ...limits.api }));

  // Modules are mounted here from step B1 on (catalogue, pricing, orders, payments…).

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
