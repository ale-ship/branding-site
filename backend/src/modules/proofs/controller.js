// @ts-check
import { MAX_CHANGE_NOTES, MAX_PIN_TEXT, MAX_PINS } from '@noorcom-branding/shared/rules/proof.js';
import { z } from 'zod';
import { accessFrom } from '../../middleware/customerAccess.js';
import { staffOf } from '../../middleware/staffAuth.js';
import { orderForStaff } from '../backoffice/service.js';
import { approveProof, originalProof, requestChanges, uploadProof } from './service.js';

/**
 * Proofs over HTTP: the customer's answer (with the order's access in a header), and the designer's
 * upload (the image as the raw body, PNG or JPEG, up to 10 MB).
 * @typedef {import('../../deps.js').Deps} Deps
 */

const ref = (/** @type {import('express').Request} */ req) => z.string().regex(/^NB-\d{6}$/i).parse(req.params.no);
const version = (/** @type {import('express').Request} */ req) => z.coerce.number().int().min(1).max(999).parse(req.params.version);

const checklistSchema = z.object({
  checklist: z.object({ spelling: z.boolean(), colours: z.boolean(), size: z.boolean(), quantity: z.boolean(), colourVariance: z.boolean() }),
});
const fraction = z.number().min(0).max(1).nullable();
const changesSchema = z.object({
  comments: z.string().max(MAX_CHANGE_NOTES).default(''),
  pins: z.array(z.object({ x: fraction, y: fraction, text: z.string().trim().min(1).max(MAX_PIN_TEXT) })).max(MAX_PINS).default([]),
});

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postApprove = (deps) => async (req, res) => {
  const { checklist } = checklistSchema.parse(req.body);
  res.set('Cache-Control', 'no-store').json(await approveProof({ ...deps, logger: req.log }, ref(req), accessFrom(req), version(req), checklist));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postChanges = (deps) => async (req, res) => {
  const { comments, pins } = changesSchema.parse(req.body);
  res.set('Cache-Control', 'no-store').json(await requestChanges({ ...deps, logger: req.log }, ref(req), accessFrom(req), version(req), comments, pins));
};

/**
 * POST /api/staff/orders/:no/proofs, the image as the body; the note in `X-Proof-Note` (URI-encoded).
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postProof = (deps) => async (req, res) => {
  const note = decodeURIComponent(req.get('x-proof-note') ?? '').slice(0, 300);
  await uploadProof({ ...deps, logger: req.log }, staffOf(req), ref(req), req.body, note);
  res.status(201).set('Cache-Control', 'no-store').json(await orderForStaff(deps, ref(req)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getOriginal = (deps) => async (req, res) => {
  const file = await originalProof(deps, ref(req), version(req));
  res.set({ 'Content-Type': file.type, 'Cache-Control': 'private, no-store', 'Content-Disposition': `inline; filename="${ref(req)}-v${version(req)}"` }).send(file.body);
};
