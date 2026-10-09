// @ts-check
import { Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit.js';
import { handlers } from './controller.js';

/**
 * /api/account (section 8). Asking for a code: 10 per 10 minutes per visitor (and one a minute per
 * email, in the service); trying one: 20 per 10 minutes per visitor (and five tries per code). Both
 * refuse in production when the limiter can't count (Redis down), as staff sign-in does.
 * @param {import('../../deps.js').Deps & { redis: import('ioredis').Redis | null }} deps
 */
export function accountRoutes(deps) {
  const h = handlers(deps);
  const failClosed = deps.config?.env === 'production';
  const router = Router();
  router.post('/code', rateLimit(deps.redis, { name: 'signin-code', limit: 10, windowSec: 600, failClosed }), h.postCode);
  router.post('/verify', rateLimit(deps.redis, { name: 'signin-verify', limit: 20, windowSec: 600, failClosed }), h.postVerify);
  router.post('/sign-out', h.postSignOut);
  router.get('/', h.getAccount);
  router.put('/details', h.putDetails);
  router.put('/brand-kit', h.putBrandKit);
  router.post('/addresses', h.postAddress);
  router.delete('/addresses/:id', h.deleteAddress);
  router.get('/reorder/:ref', h.getReorder);
  router.get('/statement', h.getStatement);
  router.post('/company', h.postCompany);
  router.post('/company/members', h.postMember);
  router.delete('/company/members/:email', h.deleteMember);
  return router;
}
