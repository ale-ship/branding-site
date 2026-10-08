// @ts-check
import express, { Router } from 'express';
import { requireRole } from '../../middleware/staffAuth.js';
import { getOriginal, postApprove, postChanges, postProof } from './controller.js';

/** The proof image's size limit (proofs/service.js MAX_PROOF_BYTES). */
const IMAGE = express.raw({ type: ['image/png', 'image/jpeg'], limit: '10mb' });

/**
 * /api/orders/:no/proofs/:version/approve and /changes: the customer's answer.
 * @param {import('../../deps.js').Deps} deps
 */
export function proofRoutes(deps) {
  const router = Router();
  router.post('/:no/proofs/:version/approve', postApprove(deps));
  router.post('/:no/proofs/:version/changes', postChanges(deps));
  return router;
}

/**
 * /api/staff/orders/:no/proofs: designers upload; staff see the original. Behind `requireStaff`.
 * @param {import('../../deps.js').Deps} deps
 */
export function staffProofRoutes(deps) {
  const router = Router();
  router.post('/orders/:no/proofs', requireRole('designer'), IMAGE, postProof(deps));
  router.get('/orders/:no/proofs/:version/original', getOriginal(deps));
  return router;
}
