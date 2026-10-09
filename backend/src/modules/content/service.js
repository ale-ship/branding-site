// @ts-check
import { pages as shippedPages } from '@noorcom-branding/shared/content/pages.js';
import { ZodError } from 'zod';
import { AppError } from '../../lib/errors.js';
import { audit } from '../staff/repo.js';
import * as repo from './repo.js';
import { KINDS, PAGE_SCHEMAS, SLUG } from './schemas.js';

/**
 * The website's content (owner, 8 Oct 2026): what the site shows, and what staff change in the back
 * office (Website). A save is checked against its schema, recorded in the audit log, and the site is
 * told to refresh, so the change is on the site at the next visit.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../staff/repo.js').Staff} Staff
 * @typedef {import('./schemas.js').Kind} Kind
 */

export const CACHE_KEY = 'nb:content:site';
const CACHE_SECONDS = 300;

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'The website’s content is unavailable for a moment.');
  return deps.pool;
}

/**
 * Everything the site shows, published only and in order. Shop products on the order form take
 * their price and minimum from it, so the shop and the order form never disagree.
 * @param {Deps} deps
 */
export async function siteContent(deps) {
  const cached = await deps.redis?.get(CACHE_KEY).catch(() => null);
  if (cached) return JSON.parse(cached);
  const pool = need(deps);
  const [rows, prices] = await Promise.all([repo.published(pool), repo.shopPrices(pool)]);
  const priceOf = new Map(prices.map((p) => [p.shop_slug, p]));
  const of = (/** @type {string} */ kind) => rows.filter((r) => r.kind === kind).map((r) => r.data);
  const page = (/** @type {'home' | 'about'} */ slug) => rows.find((r) => r.kind === 'page' && r.slug === slug)?.data ?? shippedPages[slug];
  const content = {
    services: of('service'),
    projects: of('project'),
    products: of('product').map((p) => {
      const live = priceOf.get(p.slug);
      return live ? { ...p, pricePerPiece: live.unit_price, minQuantity: live.min_qty } : p;
    }),
    clients: of('client'),
    pages: { home: page('home'), about: page('about') },
  };
  await deps.redis?.set(CACHE_KEY, JSON.stringify(content), 'EX', CACHE_SECONDS).catch(() => {});
  return content;
}

/** @param {string} kind @returns {Kind} */
function kindOf(kind) {
  if (!Object.hasOwn(KINDS, kind)) throw new AppError(404, 'not_found', 'There is no such kind of content.');
  return /** @type {Kind} */ (kind);
}

/** @param {repo.Item} r */
const view = (r) => ({
  slug: r.slug,
  published: r.published,
  position: r.position,
  updatedAt: new Date(r.updated_at).toISOString(),
  updatedBy: r.updated_by_name,
  data: r.data,
});

/**
 * @param {Deps} deps
 * @param {string} kind
 */
export async function listItems(deps, kind) {
  return (await repo.list(need(deps), kindOf(kind))).map(view);
}

/**
 * @param {Deps} deps
 * @param {string} kind
 * @param {string} slug
 */
export async function getItem(deps, kind, slug) {
  const item = await repo.get(need(deps), kindOf(kind), slug);
  if (!item) throw new AppError(404, 'not_found', 'That isn’t on the website any more.');
  return view(item);
}

/** A client's slug, from its name. */
const slugFrom = (/** @type {string} */ name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'client';

/**
 * Checks what staff sent against the kind's schema; the first problem, in words, as a 400.
 * @param {Kind} kind
 * @param {string} slug
 * @param {unknown} data
 */
function check(kind, slug, data) {
  const schema = kind === 'page' ? PAGE_SCHEMAS[/** @type {'home' | 'about'} */ (slug)] : KINDS[kind].schema;
  if (!schema) throw new AppError(404, 'not_found', 'There is no such page.');
  try {
    return /** @type {any} */ (schema).parse(data);
  } catch (err) {
    if (!(err instanceof ZodError)) throw err;
    const issue = err.issues[0];
    throw new AppError(400, 'invalid', `${issue?.path.join(' → ') || 'The content'}: ${issue?.message ?? 'not valid'}`);
  }
}

/**
 * Adds a project, shop product or client. Its slug is the one given (a client's comes from its name).
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {string} kind
 * @param {{ data: unknown; published: boolean }} body
 */
export async function createItem(deps, staff, kind, { data, published }) {
  const pool = need(deps);
  const k = kindOf(kind);
  if (!KINDS[k].open) throw new AppError(409, 'fixed', `A new ${KINDS[k].label} can’t be added here.`);
  const clean = check(k, '', data);
  let slug = k === 'client' ? slugFrom(clean.name) : clean.slug;
  if (k === 'client') for (let n = 2; await repo.get(pool, k, slug); n++) slug = `${slugFrom(clean.name)}-${n}`;
  else if (await repo.get(pool, k, slug)) throw new AppError(409, 'taken', `Another ${KINDS[k].label} already uses the address “${slug}”.`);
  await repo.insert(pool, { kind: k, slug, data: clean, published, staffId: staff.id });
  await audit(pool, staff.id, 'content-added', null, { kind: k, slug });
  await changed(deps);
  return getItem(deps, k, slug);
}

/**
 * Saves an item. A project or shop product may move to a new address (its slug).
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {string} kind
 * @param {string} slug
 * @param {{ data: unknown; published: boolean }} body
 */
export async function saveItem(deps, staff, kind, slug, { data, published }) {
  const pool = need(deps);
  const k = kindOf(kind);
  const clean = check(k, slug, data);
  const newSlug = k === 'project' || k === 'product' ? clean.slug : slug;
  if (k === 'service' && clean.slug !== slug) throw new AppError(400, 'invalid', 'A service keeps its address.');
  if (newSlug !== slug && (await repo.get(pool, k, newSlug))) throw new AppError(409, 'taken', `Another ${KINDS[k].label} already uses the address “${newSlug}”.`);
  // Pages and services are always on the site.
  const show = KINDS[k].open ? published : true;
  if (!(await repo.update(pool, { kind: k, slug, newSlug, data: clean, published: show, staffId: staff.id }))) {
    throw new AppError(404, 'not_found', 'That isn’t on the website any more.');
  }
  await audit(pool, staff.id, 'content-saved', null, { kind: k, slug: newSlug, ...(newSlug !== slug ? { was: slug } : {}) });
  await changed(deps);
  return getItem(deps, k, newSlug);
}

/**
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {string} kind
 * @param {string} slug
 */
export async function deleteItem(deps, staff, kind, slug) {
  const pool = need(deps);
  const k = kindOf(kind);
  if (!KINDS[k].open) throw new AppError(409, 'fixed', `A ${KINDS[k].label} can’t be removed; hide or change it instead.`);
  if (!(await repo.remove(pool, k, slug))) throw new AppError(404, 'not_found', 'That isn’t on the website any more.');
  await audit(pool, staff.id, 'content-removed', null, { kind: k, slug });
  await changed(deps);
}

/**
 * @param {Deps} deps
 * @param {Staff} staff
 * @param {string} kind
 * @param {string[]} slugs
 */
export async function reorderItems(deps, staff, kind, slugs) {
  const pool = need(deps);
  const k = kindOf(kind);
  if (slugs.some((s) => !SLUG.test(s))) throw new AppError(400, 'invalid', 'That order isn’t valid.');
  await repo.reorder(pool, k, slugs);
  await audit(pool, staff.id, 'content-reordered', null, { kind: k });
  await changed(deps);
  return listItems(deps, k);
}

/**
 * After any change: drop the cached content and tell the site to refresh (through the worker, which
 * retries; straight away when there is no queue).
 * @param {Deps} deps
 * @param {import('../../integrations/site/index.js').SiteTag[]} [tags]
 */
export async function changed(deps, tags = ['content']) {
  await deps.redis?.del(CACHE_KEY).catch((err) => deps.logger?.warn({ err }, 'content cache not cleared'));
  if (deps.jobs) return deps.jobs.enqueue('refresh-site', { tags });
  await refreshSite(deps, tags).catch((err) => deps.logger?.warn({ err }, 'the site was not told to refresh'));
}

/**
 * The job: ask the site to drop its cached content.
 * @param {Deps} deps
 * @param {import('../../integrations/site/index.js').SiteTag[]} tags
 */
export async function refreshSite(deps, tags) {
  if (!deps.site) return;
  await deps.site.refresh(tags);
  deps.logger?.info({ tags }, 'site refreshed');
}
