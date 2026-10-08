// @ts-check
import { notFound } from '../../lib/errors.js';
import { verifySignature } from '../../lib/signedUrl.js';

/**
 * A stored file behind a signed link (docs/BACKEND_RUNBOOK.md, section 9).
 * @param {import('../../deps.js').Deps} deps
 * @param {string} key
 * @param {string} exp
 * @param {string} sig
 */
export async function readSignedFile(deps, key, exp, sig) {
  const secret = deps.config?.files.secret ?? 'dev-files-secret';
  if (!deps.storage || !verifySignature(secret, key, exp, sig)) throw notFound();
  const file = await deps.storage.get(key);
  if (!file) throw notFound();
  return file;
}
