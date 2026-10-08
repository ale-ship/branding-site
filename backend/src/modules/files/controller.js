// @ts-check
import { readSignedFile } from './service.js';

/**
 * GET /api/files/*key. A wrong or expired signature is a plain 404. SVGs (the watermarked proofs) are
 * served with a policy that allows no scripts or outside loads.
 * @param {import('../../deps.js').Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const getFile = (deps) => async (req, res) => {
  const segments = /** @type {string[] | string} */ (req.params.key);
  const key = Array.isArray(segments) ? segments.join('/') : segments;
  const file = await readSignedFile(deps, key, String(req.query.exp ?? ''), String(req.query.sig ?? ''));
  res
    .set({
      'Content-Type': file.type,
      'Cache-Control': 'private, max-age=600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
    })
    .send(file.body);
};
