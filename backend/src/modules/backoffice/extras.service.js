// @ts-check
import { randomBytes } from 'node:crypto';
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { imageInfo } from '../../lib/images.js';
import * as flow from '../orders/flow.js';
import { countFinals, deleteFinal, findByOrderNo, insertFile } from '../orders/repo.js';
import * as site from '../orders/sitejob.js';
import { staffStep } from '../orders/steps.service.js';
import { audit } from '../staff/repo.js';
import { orderForStaff } from './service.js';

/**
 * The staff's steps after B4 (B5): photograph the pre-production sample, send an early delivery
 * out and deliver it, send a site job's firm quote and tick its stages, and a design-only order's
 * final files. Each answers the order as staff see it.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {{ id: number }} Staff
 */

export const MAX_SAMPLE_BYTES = 10 * 1024 * 1024;
export const MAX_FINAL_BYTES = 50 * 1024 * 1024;

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool || !deps.storage) throw new AppError(503, 'unavailable', 'Files are unavailable for a moment.');
  return { pool: deps.pool, storage: deps.storage };
}

/**
 * @param {Deps} deps @param {Staff} staff @param {string} ref @param {Buffer} image @param {Date} [now]
 */
export async function uploadSample(deps, staff, ref, image, now = new Date()) {
  const { storage } = need(deps);
  const info = Buffer.isBuffer(image) ? imageInfo(image) : null;
  if (!info) throw new OrderError('invalid', 'Upload the sample’s photo as a PNG or JPEG image.');
  const orderNo = ref.trim().toUpperCase();
  const key = `samples/${orderNo}/${randomBytes(8).toString('hex')}.${info.type === 'image/png' ? 'png' : 'jpg'}`;
  await storage.put(key, image, info.type);
  await staffStep(deps, staff, orderNo, 'sample-uploaded', (o) => flow.sampleReady(o, key, now), now, (trx, o) =>
    insertFile(trx, { orderId: o.id, kind: 'sample', name: 'Sample photo', key, size: image.length, type: info.type, staffId: staff.id, at: now }),
  );
  return orderForStaff(deps, orderNo);
}

/**
 * @param {Deps} deps @param {Staff} staff @param {string} ref
 * @param {{ rider?: string; riderPhone?: string; waybill?: string; recipient?: string }} d
 * @param {Date} [now]
 */
export async function moveEarlyDelivery(deps, staff, ref, d, now = new Date()) {
  await staffStep(deps, staff, ref, 'early-delivery', (o) => flow.moveEarlyDelivery(o, d, now), now);
  return orderForStaff(deps, ref);
}

/**
 * @param {Deps} deps @param {Staff} staff @param {string} ref
 * @param {Parameters<typeof site.issueQuote>[1]} q
 * @param {Date} [now]
 */
export async function issueSiteQuote(deps, staff, ref, q, now = new Date()) {
  await staffStep(deps, staff, ref, 'site-quote', (o) => site.issueQuote(o, q, nairobiToday(now), now), now);
  return orderForStaff(deps, ref);
}

/** @param {Deps} deps @param {Staff} staff @param {string} ref @param {Date} [now] */
export async function nextStage(deps, staff, ref, now = new Date()) {
  await staffStep(deps, staff, ref, 'stage', (o) => site.nextStage(o, now), now);
  return orderForStaff(deps, ref);
}

/** A file name that is safe in a storage key and a download, keeping its extension. @param {string} raw */
export function safeName(raw) {
  const name = raw.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|-+$/g, '').slice(-100);
  return /\.[a-z0-9]{1,8}$/i.test(name) ? name : `${name || 'file'}.bin`;
}

/**
 * A design-only order's final file (any type, up to 50 MB), once the design is approved.
 * @param {Deps} deps @param {Staff} staff @param {string} ref
 * @param {{ body: Buffer; name: string; type: string }} file
 * @param {Date} [now]
 */
export async function uploadFinal(deps, staff, ref, { body, name, type }, now = new Date()) {
  const { pool, storage } = need(deps);
  if (!Buffer.isBuffer(body) || body.length === 0) throw new OrderError('invalid', 'Choose a file to upload.');
  const orderNo = ref.trim().toUpperCase();
  const order = await findByOrderNo(pool, orderNo);
  if (!order) throw new OrderError('not_found', 'There is no order with that number.');
  flow.checkFinalsOpen(order);
  const clean = safeName(name);
  const key = `finals/${orderNo}/${randomBytes(6).toString('hex')}/${clean}`;
  await storage.put(key, body, type || 'application/octet-stream');
  await withTransaction(pool, async (trx) => {
    const locked = await findByOrderNo(trx, orderNo, { lock: true });
    flow.checkFinalsOpen(/** @type {Record<string, any>} */ (locked));
    await insertFile(trx, { orderId: order.id, kind: 'final', name: clean, key, size: body.length, type: type || 'application/octet-stream', staffId: staff.id, at: now });
    await audit(trx, staff.id, 'final-file-added', order.id, { name: clean, size: body.length });
  });
  return orderForStaff(deps, orderNo);
}

/** @param {Deps} deps @param {Staff} staff @param {string} ref @param {number} id */
export async function removeFinal(deps, staff, ref, id) {
  const { pool, storage } = need(deps);
  const orderNo = ref.trim().toUpperCase();
  const key = await withTransaction(pool, async (trx) => {
    const order = await findByOrderNo(trx, orderNo, { lock: true });
    if (!order) throw new OrderError('not_found', 'There is no order with that number.');
    flow.checkFinalsOpen(order);
    const removed = await deleteFinal(trx, order.id, id);
    if (!removed) throw new OrderError('not_found', 'That file isn’t on this order.');
    await audit(trx, staff.id, 'final-file-removed', order.id, { id });
    return removed;
  });
  await storage.remove(key);
  return orderForStaff(deps, orderNo);
}

/** Sends the final files: the design-only order completes. @param {Deps} deps @param {Staff} staff @param {string} ref @param {Date} [now] */
export async function sendFinals(deps, staff, ref, now = new Date()) {
  const { pool } = need(deps);
  const orderNo = ref.trim().toUpperCase();
  const order = await findByOrderNo(pool, orderNo);
  if (!order) throw new OrderError('not_found', 'There is no order with that number.');
  const files = await countFinals(pool, order.id);
  await staffStep(deps, staff, orderNo, 'final-files-sent', (o) => flow.filesSent(o, files, now), now);
  return orderForStaff(deps, orderNo);
}
