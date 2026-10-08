// @ts-check
import { z } from 'zod';
import { staffOf } from '../../middleware/staffAuth.js';
import { dashboard } from './dashboard.service.js';
import * as service from './service.js';

/**
 * The back office's order endpoints. Every body is parsed here; the service and the step rules
 * decide what is allowed.
 * @typedef {import('../../deps.js').Deps} Deps
 */

const ref = (/** @type {import('express').Request} */ req) => z.string().regex(/^NB-\d{6}$/i).parse(req.params.no);
const noStore = (/** @type {import('express').Response} */ res) => res.set('Cache-Control', 'no-store');

const boardQuery = z.object({
  column: z.enum(/** @type {[keyof typeof service.COLUMNS, ...(keyof typeof service.COLUMNS)[]]} */ (Object.keys(service.COLUMNS))).optional(),
  q: z.string().max(100).optional(),
  mechanism: z.enum(['A', 'B', 'C']).optional(),
});
const progressBody = z.object({ pieces: z.number().int().min(1).max(1_000_000), note: z.string().max(200).default('') });
const dispatchBody = z.object({
  rider: z.string().trim().max(120).default(''),
  riderPhone: z.string().trim().max(30).default(''),
  waybill: z.string().trim().max(60).default(''),
});
const handOverBody = z.object({ code: z.string().max(10).optional(), collector: z.string().max(120).optional(), recipient: z.string().max(120).optional() });
const cancelBody = z.object({ reason: z.string().max(300) });
const assignBody = z.object({ ref: z.string().trim().regex(/^NB-\d{6}$/i) });
const id = (/** @type {import('express').Request} */ req) => z.coerce.number().int().positive().parse(req.params.id);

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getBoard = (deps) => async (req, res) => {
  noStore(res).json({ orders: await service.board(deps, boardQuery.parse(req.query)) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getOrder = (deps) => async (req, res) => {
  noStore(res).json(await service.orderForStaff(deps, ref(req)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postProgress = (deps) => async (req, res) => {
  const { pieces, note } = progressBody.parse(req.body);
  noStore(res).json(await service.logProgress({ ...deps, logger: req.log }, staffOf(req), ref(req), pieces, note));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postReady = (deps) => async (req, res) => {
  noStore(res).json(await service.markReady({ ...deps, logger: req.log }, staffOf(req), ref(req)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postDispatch = (deps) => async (req, res) => {
  noStore(res).json(await service.dispatch({ ...deps, logger: req.log }, staffOf(req), ref(req), dispatchBody.parse(req.body)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postHandOver = (deps) => async (req, res) => {
  noStore(res).json(await service.handOver({ ...deps, logger: req.log }, staffOf(req), ref(req), handOverBody.parse(req.body)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postCancel = (deps) => async (req, res) => {
  noStore(res).json(await service.cancelOrder({ ...deps, logger: req.log }, staffOf(req), ref(req), cancelBody.parse(req.body).reason));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postClearAttention = (deps) => async (req, res) => {
  noStore(res).json(await service.clearAttention(deps, staffOf(req), ref(req)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getUnmatched = (deps) => async (_req, res) => {
  noStore(res).json({ payments: await service.unmatchedPayments(deps) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postAssign = (deps) => async (req, res) => {
  const result = await service.assignPayment({ ...deps, logger: req.log }, staffOf(req), id(req), assignBody.parse(req.body).ref.toUpperCase());
  noStore(res).json({ result });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postRefund = (deps) => async (req, res) => {
  await service.refundPayment(deps, staffOf(req), id(req));
  res.status(204).end();
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getDashboard = (deps) => async (_req, res) => {
  noStore(res).json(await dashboard(deps));
};
