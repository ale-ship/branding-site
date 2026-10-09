// @ts-check
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { AppError } from '../../lib/errors.js';
import { audit } from '../staff/repo.js';
import * as repo from './repo.js';

/**
 * The website's photos (the media library). An upload is turned the right way up, stripped of what
 * the camera recorded (including where it was taken), shrunk to at most 2400 px on its long side and
 * saved as JPEG (PNG when it has see-through parts, such as a logo), with a small WebP thumbnail for
 * the back office. Files live in storage under media/ and are public at /api/media/<name>.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../staff/repo.js').Staff} Staff
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const LONG_SIDE = 2400;
const THUMB = 480;
const READABLE = ['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'];
/** A public file's name: the photo or its thumbnail. */
export const MEDIA_NAME = /^[a-z0-9]{24}(\.jpg|\.png|-thumb\.webp)$/;

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool || !deps.storage) throw new AppError(503, 'unavailable', 'Photos are unavailable for a moment.');
  return { pool: deps.pool, storage: deps.storage };
}

/** @param {string} key media/<name>.jpg */
const srcOf = (key) => `/api/${key}`;
const thumbOf = (/** @type {string} */ key) => `/api/${key.replace(/\.(jpg|png)$/, '-thumb.webp')}`;

/** @param {repo.Media} m */
const view = (m) => ({
  id: m.id,
  src: srcOf(m.key),
  thumb: thumbOf(m.key),
  filename: m.filename,
  alt: m.alt,
  width: m.width,
  height: m.height,
  bytes: m.bytes,
  uploadedAt: new Date(m.created_at).toISOString(),
  uploadedBy: m.uploaded_by_name,
});

/**
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {Buffer} body
 * @param {{ filename: string; alt: string }} meta
 */
export async function uploadMedia(deps, staff, body, { filename, alt }) {
  const { pool, storage } = need(deps);
  if (!Buffer.isBuffer(body) || !body.length) throw new AppError(400, 'invalid', 'Choose a photo to upload.');
  if (body.length > MAX_UPLOAD_BYTES) throw new AppError(413, 'too_large', 'That photo is over 15 MB.');
  let info;
  try {
    info = await sharp(body).metadata();
  } catch {
    info = null;
  }
  if (!info?.format || !READABLE.includes(info.format)) throw new AppError(400, 'invalid', 'That isn’t a photo we can read. Use JPEG, PNG or WebP.');

  const see = Boolean(info.hasAlpha);
  const resized = sharp(body, { failOn: 'error', animated: false })
    .rotate()
    .resize({ width: LONG_SIDE, height: LONG_SIDE, fit: 'inside', withoutEnlargement: true });
  let out;
  try {
    out = await (see ? resized.png({ compressionLevel: 9, palette: false }) : resized.flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true })).toBuffer({
      resolveWithObject: true,
    });
  } catch {
    throw new AppError(400, 'invalid', 'That photo looks damaged. Try saving it again and uploading the new copy.');
  }
  const thumb = await sharp(out.data).resize({ width: THUMB, height: THUMB, fit: 'inside' }).webp({ quality: 70 }).toBuffer();

  const ext = see ? 'png' : 'jpg';
  const key = `media/${randomBytes(12).toString('hex')}.${ext}`;
  await storage.put(key, out.data, see ? 'image/png' : 'image/jpeg');
  await storage.put(key.replace(/\.(jpg|png)$/, '-thumb.webp'), thumb, 'image/webp');
  const id = await repo.insertMedia(pool, {
    key,
    filename: filename.slice(0, 200) || `photo.${ext}`,
    type: see ? 'image/png' : 'image/jpeg',
    bytes: out.info.size,
    width: out.info.width,
    height: out.info.height,
    alt: alt.trim().slice(0, 300),
    staffId: staff.id,
  });
  await audit(pool, staff.id, 'media-uploaded', null, { id, filename });
  return view(/** @type {repo.Media} */ (await repo.getMedia(pool, id)));
}

/**
 * @param {Deps} deps
 * @param {string} q
 */
export async function listMedia(deps, q) {
  return (await repo.listMedia(need(deps).pool, q.trim())).map(view);
}

/**
 * The description used when the photo is picked (pages keep their own copy).
 * @param {Deps} deps
 * @param {number} id
 * @param {string} alt
 */
export async function describeMedia(deps, id, alt) {
  const { pool } = need(deps);
  if (!(await repo.setMediaAlt(pool, id, alt.trim().slice(0, 300)))) throw new AppError(404, 'not_found', 'That photo has been deleted.');
  return view(/** @type {repo.Media} */ (await repo.getMedia(pool, id)));
}

/**
 * Deletes a photo nothing on the website shows.
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {number} id
 */
export async function deleteMedia(deps, staff, id) {
  const { pool, storage } = need(deps);
  const m = await repo.getMedia(pool, id);
  if (!m) throw new AppError(404, 'not_found', 'That photo has been deleted.');
  const uses = await repo.usedBy(pool, srcOf(m.key));
  if (uses.length) {
    const where = uses.map((u) => `${u.kind} “${u.slug}”`).join(', ');
    throw new AppError(409, 'in_use', `The website still shows this photo (${where}). Replace it there first.`);
  }
  await repo.removeMedia(pool, id);
  await Promise.all([storage.remove(m.key), storage.remove(m.key.replace(/\.(jpg|png)$/, '-thumb.webp'))]);
  await audit(pool, staff.id, 'media-deleted', null, { id, filename: m.filename });
}

/**
 * A public photo or thumbnail by its name.
 * @param {Deps} deps
 * @param {string} name
 */
export async function readMedia(deps, name) {
  if (!MEDIA_NAME.test(name) || !deps.storage) throw new AppError(404, 'not_found', 'No such photo.');
  const file = await deps.storage.get(`media/${name}`);
  if (!file) throw new AppError(404, 'not_found', 'No such photo.');
  return file;
}
