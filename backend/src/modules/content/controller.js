// @ts-check
import { z } from 'zod';
import { staffOf } from '../../middleware/staffAuth.js';
import * as media from './media.service.js';
import * as content from './service.js';

/**
 * The website's content: the site reads it (GET /api/content), staff edit it (/api/staff/content and
 * /api/staff/media), and photos are public (GET /api/media/<name>).
 * @typedef {import('../../deps.js').Deps} Deps
 */

const noStore = (/** @type {import('express').Response} */ res) => res.set('Cache-Control', 'no-store');
const kind = (/** @type {import('express').Request} */ req) => z.string().max(20).parse(req.params.kind);
const slug = (/** @type {import('express').Request} */ req) => z.string().max(80).parse(req.params.slug);
const id = (/** @type {import('express').Request} */ req) => z.coerce.number().int().positive().parse(req.params.id);
const itemBody = z.object({ data: z.unknown(), published: z.boolean().default(true) }).transform(({ data, published }) => ({ data, published }));
const orderBody = z.object({ slugs: z.array(z.string().max(80)).max(500) });
const uploadQuery = z.object({ filename: z.string().max(200).default(''), alt: z.string().max(300).default('') });

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getSiteContent = (deps) => async (_req, res) => {
  noStore(res).json(await content.siteContent(deps));
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getMedia = (deps) => async (req, res) => {
  const file = await media.readMedia(deps, String(req.params.name));
  res
    .set({
      'Content-Type': file.type,
      // Each upload has its own random name, so it never changes.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    })
    .send(file.body);
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getItems = (deps) => async (req, res) => {
  noStore(res).json({ items: await content.listItems(deps, kind(req)) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getItem = (deps) => async (req, res) => {
  noStore(res).json({ item: await content.getItem(deps, kind(req), slug(req)) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postItem = (deps) => async (req, res) => {
  const body = itemBody.parse(req.body);
  noStore(res)
    .status(201)
    .json({ item: await content.createItem({ ...deps, logger: req.log }, staffOf(req), kind(req), body) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const putItem = (deps) => async (req, res) => {
  const body = itemBody.parse(req.body);
  noStore(res).json({ item: await content.saveItem({ ...deps, logger: req.log }, staffOf(req), kind(req), slug(req), body) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const deleteItem = (deps) => async (req, res) => {
  await content.deleteItem({ ...deps, logger: req.log }, staffOf(req), kind(req), slug(req));
  res.status(204).end();
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postOrder = (deps) => async (req, res) => {
  noStore(res).json({ items: await content.reorderItems({ ...deps, logger: req.log }, staffOf(req), kind(req), orderBody.parse(req.body).slugs) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getLibrary = (deps) => async (req, res) => {
  noStore(res).json({ media: await media.listMedia(deps, z.string().max(100).default('').parse(req.query.q)) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postMedia = (deps) => async (req, res) => {
  const meta = uploadQuery.parse(req.query);
  noStore(res)
    .status(201)
    .json({ media: await media.uploadMedia(deps, staffOf(req), req.body, meta) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const patchMedia = (deps) => async (req, res) => {
  const { alt } = z.object({ alt: z.string().max(300) }).parse(req.body);
  noStore(res).json({ media: await media.describeMedia(deps, id(req), alt) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const deleteMedia = (deps) => async (req, res) => {
  await media.deleteMedia(deps, staffOf(req), id(req));
  res.status(204).end();
};
