// @ts-check
import { z } from 'zod';

/**
 * What staff may save for each kind of content: the contract's shapes (shared/contract/content.d.ts)
 * with limits, so a mistake in the back office can't break a page. Text is trimmed; photos only
 * point at the site's own images or our uploads (never another site), and every photo has words
 * for screen readers.
 */

export const SERVICE_SLUGS = /** @type {const} */ (['indoor-branding', 'outdoor-branding', 'vehicle-branding', 'apparel', 'corporate-gifts', 'stationery', 'large-format']);
export const PRODUCT_CATEGORIES = /** @type {const} */ (['stationery', 'print', 'apparel', 'gifts', 'display']);

/** A web address part: lower case words joined by hyphens. */
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const text = (/** @type {number} */ min, /** @type {number} */ max) => z.string().trim().min(min).max(max);
const words = (/** @type {number} */ max) => z.array(text(1, 80)).max(max);

/** The site's shipped images (public/images, public/brand) or an upload (/api/media/…). */
const SRC = /^\/(images\/[a-z0-9][a-z0-9/_.-]*\.(jpg|jpeg|png|webp|svg)|brand\/[a-z0-9_.-]+\.png|api\/media\/[a-z0-9]{16,40}\.(jpg|png))$/i;

export const photo = z.object({
  src: z.string().regex(SRC, 'Pick a photo from the media library.'),
  alt: text(1, 300),
});
const captioned = photo.extend({ caption: z.string().trim().max(200).optional() }).transform(({ caption, ...p }) => (caption ? { ...p, caption } : p));
const heading = { eyebrow: text(1, 60), title: text(1, 160) };

export const service = z.object({
  slug: z.enum(SERVICE_SLUGS),
  name: text(1, 60),
  summary: text(1, 200),
  intro: text(1, 1200),
  includes: words(20),
  materials: z.array(text(1, 160)).max(20),
  turnaround: text(1, 60),
  minimum: text(1, 60),
  productCategories: z.array(z.enum(PRODUCT_CATEGORIES)).max(5),
  faqs: z.array(z.object({ question: text(1, 200), answer: text(1, 1200) })).max(15),
  image: photo,
});

export const project = z.object({
  slug: z.string().regex(SLUG).max(80),
  title: text(1, 160),
  client: text(1, 120),
  industry: text(1, 80),
  year: z.number().int().min(1990).max(2100),
  location: text(1, 80),
  services: z.array(z.enum(SERVICE_SLUGS)).min(1, 'Pick at least one service.').max(7),
  summary: text(1, 400),
  cover: photo,
  palette: z.array(z.string().regex(/^#[0-9a-f]{6}$/i, 'Colours are written like #d7000f.')).max(8),
  brief: text(1, 3000),
  idea: text(1, 3000),
  result: text(1, 3000),
  facts: z.array(z.object({ label: text(1, 60), value: text(1, 30) })).max(6),
  materials: z.array(text(1, 160)).max(15),
  applications: z.array(captioned).max(16),
  behindTheScenes: z.array(captioned).max(16),
  beforeAfter: z.object({ before: photo, after: photo }).nullable(),
  featured: z.boolean(),
  sample: z.boolean(),
});

export const product = z.object({
  slug: z.string().regex(SLUG).max(80),
  name: text(1, 80),
  category: z.enum(PRODUCT_CATEGORIES),
  service: z.enum(SERVICE_SLUGS),
  pricePerPiece: z.number().int().min(0).max(10_000_000),
  minQuantity: z.number().int().min(1).max(100_000),
  summary: text(1, 200),
  description: text(1, 2000),
  options: z.array(z.object({ name: text(1, 40), values: z.array(text(1, 60)).min(1).max(15) })).max(6),
  image: photo,
  featured: z.boolean(),
});

export const client = z.object({ name: text(1, 80), logo: photo.nullable() });

const home = z.object({
  hero: z.object({ latestTitle: text(1, 40), latestSubtitle: text(1, 80), discoverTitle: text(1, 40), discoverSubtitle: text(1, 80) }),
  workshop: z.object({ image: photo, caption: text(1, 80), facts: z.array(z.object({ value: text(1, 30), label: text(1, 120) })).min(1).max(3) }),
  inHouse: z.object({ ...heading, text: text(1, 600), buttonLabel: text(1, 40), images: z.array(photo).min(1).max(4) }),
  process: z.object({ ...heading, steps: z.array(z.object({ name: text(1, 30), text: text(1, 300) })).min(3).max(6) }),
  clients: z.object({ title: text(1, 80) }),
  cta: z.object({ ...heading, text: text(1, 400) }),
});

const about = z.object({
  header: z.object({ title: text(1, 160), intro: text(1, 600) }),
  image: photo,
  story: z.array(text(1, 1200)).min(1).max(6),
  principles: z.object({ ...heading, items: z.array(z.object({ title: text(1, 80), text: text(1, 400) })).min(1).max(6) }),
  workshop: z.object({ ...heading, photos: z.array(captioned).min(1).max(8) }),
});

/**
 * Each kind: its schema, and whether staff may add and remove items (services and pages are fixed:
 * the site has a page for each).
 */
export const KINDS = {
  service: { schema: service, open: false, label: 'service' },
  project: { schema: project, open: true, label: 'project' },
  product: { schema: product, open: true, label: 'shop product' },
  client: { schema: client, open: true, label: 'client' },
  page: { schema: z.union([home, about]), open: false, label: 'page' },
};
/** @typedef {keyof typeof KINDS} Kind */

/** The schema a page's slug needs. */
export const PAGE_SCHEMAS = { home, about };
