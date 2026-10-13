// @ts-check
import { z } from 'zod';
import { staffOf } from '../../middleware/staffAuth.js';
import { changeSchema, messageSchema, quoteSchema, STATUSES } from './schemas.js';
import { changeRequest, getRequest, listRequests, sendMessage, submitQuote } from './service.js';

/**
 * Requests over HTTP: the site's two forms (the site's server posts them, passing the visitor's
 * address on), and the staff inbox.
 * @typedef {import('../../deps.js').Deps} Deps
 */

const ref = z.string().regex(/^N[QM]-\d{6}$/i);
const listQuery = z.object({ status: z.enum(STATUSES).optional(), q: z.string().max(100).optional() });

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postQuote = (deps) => async (req, res) => {
  res.set('Cache-Control', 'no-store').status(201).json(await submitQuote({ ...deps, logger: req.log }, quoteSchema.parse(req.body)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postMessage = (deps) => async (req, res) => {
  res.set('Cache-Control', 'no-store').status(201).json(await sendMessage({ ...deps, logger: req.log }, messageSchema.parse(req.body)));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getRequests = (deps) => async (req, res) => {
  res.set('Cache-Control', 'no-store').json({ requests: await listRequests(deps, listQuery.parse(req.query)) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getOne = (deps) => async (req, res) => {
  res.set('Cache-Control', 'no-store').json({ request: await getRequest(deps, ref.parse(req.params.ref)) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const patchOne = (deps) => async (req, res) => {
  res.set('Cache-Control', 'no-store').json({ request: await changeRequest(deps, staffOf(req), ref.parse(req.params.ref), changeSchema.parse(req.body)) });
};
