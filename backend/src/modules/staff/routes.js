// @ts-check
import { Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit.js';
import { requireRole } from '../../middleware/staffAuth.js';
import { getMe, getUsers, patchUser, postSignIn, postSignOut, postUser } from './controller.js';

/**
 * /api/staff/auth and /api/staff/users. Sign-in is limited to 10 tries per 10 minutes per address and
 * refuses when the limiter can't count (Redis down), as sign-in codes do.
 * @param {import('../../deps.js').Deps & { redis: import('ioredis').Redis | null }} deps
 */
export function staffAuthRoutes(deps) {
  const router = Router();
  router.post('/sign-in', rateLimit(deps.redis, { name: 'staff-sign-in', limit: 10, windowSec: 600, failClosed: deps.config?.env === 'production' }), postSignIn(deps));
  router.post('/sign-out', postSignOut(deps));
  return router;
}

/**
 * The signed-in staff member and staff accounts; mounted behind `requireStaff` (app.js).
 * @param {import('../../deps.js').Deps} deps
 */
export function staffRoutes(deps) {
  const router = Router();
  router.get('/me', getMe);
  router.get('/users', requireRole('admin'), getUsers(deps));
  router.post('/users', requireRole('admin'), postUser(deps));
  router.patch('/users/:id', requireRole('admin'), patchUser(deps));
  return router;
}
