// @ts-check
import { Router } from 'express';
import { getFile } from './controller.js';

/**
 * /api/files/<key>?exp=…&sig=…: stored files behind short-lived signed links (lib/signedUrl.js).
 * @param {import('../../deps.js').Deps} deps
 */
export function fileRoutes(deps) {
  const router = Router();
  router.get('/*key', getFile(deps));
  return router;
}
