// @ts-check
import express, { Router } from 'express';
import { requireRole } from '../../middleware/staffAuth.js';
import * as c from './controller.js';

/** Photos as they are uploaded (media.service.js MAX_UPLOAD_BYTES): anything sharp may read. */
const PHOTO = express.raw({ type: ['image/*'], limit: '15mb' });

/**
 * GET /api/content: everything the website shows. Read by the site's server (cached there).
 * @param {import('../../deps.js').Deps} deps
 */
export function contentRoutes(deps) {
  const router = Router();
  router.get('/', c.getSiteContent(deps));
  return router;
}

/**
 * GET /api/media/<name>: the website's photos, public and cached for a year. Mounted before the
 * per-visitor limit: a page shows many, and the site's image optimiser fetches them from one address.
 * @param {import('../../deps.js').Deps} deps
 */
export function mediaRoutes(deps) {
  const router = Router();
  router.get('/:name', c.getMedia(deps));
  return router;
}

/**
 * /api/staff/content/:kind[/:slug] and /api/staff/media: the website editor (owner, 8 Oct 2026: the
 * admin and the designers). Behind `requireStaff`.
 * @param {import('../../deps.js').Deps} deps
 */
export function staffContentRoutes(deps) {
  const router = Router();
  const editor = requireRole('designer');
  router.get('/content/:kind', c.getItems(deps));
  router.post('/content/:kind', editor, c.postItem(deps));
  router.post('/content/:kind/order', editor, c.postOrder(deps));
  router.get('/content/:kind/:slug', c.getItem(deps));
  router.put('/content/:kind/:slug', editor, c.putItem(deps));
  router.delete('/content/:kind/:slug', editor, c.deleteItem(deps));
  router.get('/media', c.getLibrary(deps));
  router.post('/media', editor, PHOTO, c.postMedia(deps));
  router.patch('/media/:id', editor, c.patchMedia(deps));
  router.delete('/media/:id', editor, c.deleteMedia(deps));
  return router;
}
