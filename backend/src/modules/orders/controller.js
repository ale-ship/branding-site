// @ts-check
import { orderInputSchema, orderLookupSchema } from '@noorcom-branding/shared/contract/schemas.js';
import { z } from 'zod';
import { accessFrom } from '../../middleware/customerAccess.js';
import * as extras from './extras.service.js';
import { createOrder, getOrder } from './service.js';

/**
 * The customer's side of orders. The secret token travels in a header, never in the URL, so it stays
 * out of access logs (section 9). Order answers are never cached.
 * @typedef {import('../../deps.js').Deps} Deps
 */

/** @param {import('express').Response} res */
const noStore = (res) => res.set('Cache-Control', 'no-store');

/**
 * POST /api/orders: an `OrderInput` in; 201 with `{ ref, token }`.
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postOrder = (deps) => async (req, res) => {
  const input = orderInputSchema.parse(req.body);
  // A company order needs the member's session, which the site passes on from its cookie.
  noStore(res).status(201).json(await createOrder({ ...deps, logger: req.log }, input, undefined, { session: req.get('x-account-session') ?? '' }));
};

/**
 * GET /api/orders/:no with the secret token in `X-Order-Token` (or the phone in `X-Order-Phone`).
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const getOrderHandler = (deps) => async (req, res) => {
  noStore(res).json(await getOrder({ ...deps, logger: req.log }, String(req.params.no), accessFrom(req)));
};

/**
 * POST /api/orders/lookup: `{ ref, phone }`, the order number and the phone it was placed with.
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postLookup = (deps) => async (req, res) => {
  const { ref, phone } = orderLookupSchema.parse(req.body);
  noStore(res).json(await getOrder({ ...deps, logger: req.log }, ref, { phone }));
};

// B5: the customer's steps after paying, with the order's access in a header.
const no = (/** @type {import('express').Request} */ req) => z.string().regex(/^NB-\d{6}$/i).parse(req.params.no);
const sampleBody = z.object({ decision: z.enum(['approve', 'changes']), comments: z.string().max(2000).default('') });
const piecesBody = z.object({ pieces: z.number().int().min(1).max(1_000_000) });
const reportBody = z.object({ code: z.string().min(1).max(40), amount: z.number().int().min(1).max(10_000_000).nullable().default(null) });
const dateBody = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.') });

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postSampleReview = (deps) => async (req, res) => {
  const { decision, comments } = sampleBody.parse(req.body);
  noStore(res).json(await extras.reviewSample({ ...deps, logger: req.log }, no(req), accessFrom(req), decision, comments));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postEarlyDelivery = (deps) => async (req, res) => {
  noStore(res).json(await extras.requestEarlyDelivery({ ...deps, logger: req.log }, no(req), accessFrom(req), piecesBody.parse(req.body).pieces));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postSurvey = (deps) => async (req, res) => {
  noStore(res).json(await extras.bookSurvey({ ...deps, logger: req.log }, no(req), accessFrom(req), dateBody.parse(req.body).date));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postAcceptQuote = (deps) => async (req, res) => {
  noStore(res).json(await extras.acceptSiteQuote({ ...deps, logger: req.log }, no(req), accessFrom(req)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postInstall = (deps) => async (req, res) => {
  noStore(res).json(await extras.bookInstall({ ...deps, logger: req.log }, no(req), accessFrom(req), dateBody.parse(req.body).date));
};

/**
 * POST /api/orders/:no/payment-report: `{ code, amount }`, the customer's M-Pesa code for staff to check.
 * @param {Deps} deps @returns {import('express').RequestHandler}
 */
export const postPaymentReport = (deps) => async (req, res) => {
  const { code, amount } = reportBody.parse(req.body);
  noStore(res).json(await extras.reportPayment({ ...deps, logger: req.log }, no(req), accessFrom(req), code, amount));
};
