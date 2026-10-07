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
