// @ts-check
import { z } from 'zod';
import { staffOf } from '../../middleware/staffAuth.js';
import * as extras from './extras.service.js';

/**
 * The staff's B5 steps over HTTP: the sample's photo and a final file come as the raw request body
 * (a file's name in `X-File-Name`, URI-encoded); everything else is JSON.
 * @typedef {import('../../deps.js').Deps} Deps
 */

const ref = (/** @type {import('express').Request} */ req) => z.string().regex(/^NB-\d{6}$/i).parse(req.params.no);
const noStore = (/** @type {import('express').Response} */ res) => res.set('Cache-Control', 'no-store');

const deliveryBody = z.object({
  rider: z.string().trim().max(120).default(''),
  riderPhone: z.string().trim().max(30).default(''),
  waybill: z.string().trim().max(60).default(''),
  recipient: z.string().trim().max(120).default(''),
});
const quoteBody = z.object({
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        material: z.enum(['vinyl', 'wallpaper', 'frosted', 'acp-sign', 'lightbox', 'flex-banner', 'vehicle-wrap']),
        widthCm: z.number().positive().max(10_000),
        heightCm: z.number().positive().max(10_000),
        quantity: z.number().int().min(1).max(1000),
      }),
    )
    .min(1)
    .max(30),
  extras: z
    .array(z.object({ label: z.string().trim().min(1).max(120), detail: z.string().trim().max(200).default(''), amount: z.number().int().min(0).max(100_000_000) }))
    .max(10)
    .default([]),
  notes: z.string().max(2000).default(''),
});

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postSample = (deps) => async (req, res) => {
  noStore(res).json(await extras.uploadSample({ ...deps, logger: req.log }, staffOf(req), ref(req), req.body));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postEarlyDelivery = (deps) => async (req, res) => {
  noStore(res).json(await extras.moveEarlyDelivery({ ...deps, logger: req.log }, staffOf(req), ref(req), deliveryBody.parse(req.body)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postSiteQuote = (deps) => async (req, res) => {
  noStore(res).json(await extras.issueSiteQuote({ ...deps, logger: req.log }, staffOf(req), ref(req), quoteBody.parse(req.body)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postStage = (deps) => async (req, res) => {
  noStore(res).json(await extras.nextStage({ ...deps, logger: req.log }, staffOf(req), ref(req)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postFinal = (deps) => async (req, res) => {
  const name = decodeURIComponent(z.string().max(400).parse(req.get('x-file-name') ?? 'file'));
  const type = z.string().max(120).parse(req.get('content-type') ?? 'application/octet-stream').split(';')[0] ?? 'application/octet-stream';
  noStore(res).json(await extras.uploadFinal({ ...deps, logger: req.log }, staffOf(req), ref(req), { body: req.body, name, type }));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const deleteFinal = (deps) => async (req, res) => {
  noStore(res).json(await extras.removeFinal({ ...deps, logger: req.log }, staffOf(req), ref(req), z.coerce.number().int().positive().parse(req.params.id)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postSendFinals = (deps) => async (req, res) => {
  noStore(res).json(await extras.sendFinals({ ...deps, logger: req.log }, staffOf(req), ref(req)));
};
