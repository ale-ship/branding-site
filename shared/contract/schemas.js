// @ts-check
import { z } from 'zod';
import { DELIVERY_ZONES, URGENCY_TIERS } from '../rules/pricing.js';

/**
 * Runtime checks for what crosses the wire (docs/BACKEND_RUNBOOK.md, section 2): the backend's
 * controllers parse every request body with these before a service sees it. The shapes match
 * order-types.d.ts; the limits keep a hostile body small. Schemas join here as endpoints need them.
 */

const zones = /** @type {[import('./order-types.js').DeliveryZone, ...import('./order-types.js').DeliveryZone[]]} */ (DELIVERY_ZONES.map((z) => z.zone));
const urgencies = /** @type {[import('./order-types.js').UrgencyCode, ...import('./order-types.js').UrgencyCode[]]} */ (URGENCY_TIERS.map((t) => t.code));

const address = z.string().trim().max(300);

/** One answer in a brief: see `BriefValue`. Dimensions before the record, which would also match them. */
export const briefValueSchema = z.union([
  z.string().max(4000),
  z.array(z.string().max(200)).max(50),
  z.number().finite(),
  z.boolean(),
  z.object({ widthCm: z.number().positive().max(100_000), heightCm: z.number().positive().max(100_000) }).strict(),
  z.record(z.string().max(40), z.number().int().min(0).max(1_000_000)),
]);

export const briefAnswersSchema = z.record(z.string().max(60), briefValueSchema);

export const handoverSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('pickup') }),
  z.object({ method: z.literal('delivery'), zone: z.enum(zones), address }),
  z.object({ method: z.literal('install'), address }),
  z.object({ method: z.literal('digital') }),
]);

/** POST /api/quotes/price: `PriceRequest`. */
export const priceRequestSchema = z.object({
  product: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(100_000),
  brief: briefAnswersSchema,
  needsDesign: z.boolean(),
  urgency: z.enum(urgencies),
  handover: handoverSchema,
});

const file = z.object({ name: z.string().max(200), size: z.number().finite().min(0), type: z.string().max(100) });

/** The brief every order shares: `CommonBrief`. */
export const commonBriefSchema = z.object({
  colours: z.array(z.string().trim().max(40)).max(5),
  typography: z.enum(['from-logo', 'designer', 'named']),
  fonts: z.string().trim().max(200),
  assets: z.array(file).max(10),
  inspiration: z.array(file).max(10),
  inspirationLinks: z.array(z.string().trim().max(500)).max(5),
  text: z.string().max(4000),
  styles: z.array(z.string().max(40)).max(10),
  artwork: z.enum(['print-ready', 'need-design']),
  notes: z.string().max(4000),
});

/** Who is ordering: `Customer`. The service normalises the phone and email and refuses what isn't one. */
export const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().max(120),
  phone: z.string().trim().min(1).max(30),
  email: z.string().trim().min(3).max(200),
});

/**
 * POST /api/orders: `OrderInput`. `company` asks for a company order; the company itself comes from
 * the signed-in member's session (`X-Account-Session`), never from the request, so its id is ignored.
 */
export const orderInputSchema = priceRequestSchema.extend({
  common: commonBriefSchema,
  customer: customerSchema,
  company: z.object({ id: z.string().max(20).default(''), poNumber: z.string().trim().max(40).default('') }).optional(),
});

/** POST /api/orders/lookup: the order number and the phone it was placed with. */
export const orderLookupSchema = z.object({
  ref: z.string().trim().toUpperCase().regex(/^NB-\d{6}$/),
  phone: z.string().trim().min(1).max(30),
});

/** POST /api/payments/stk: which order, and the number to send the M-Pesa prompt to. */
export const stkRequestSchema = z.object({
  ref: z.string().trim().toUpperCase().regex(/^NB-\d{6}$/),
  phone: z.string().trim().min(1).max(30),
});
