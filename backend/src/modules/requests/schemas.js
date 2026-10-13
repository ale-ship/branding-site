// @ts-check
import { z } from 'zod';

/**
 * What the site's quote and contact forms send (`QuoteRequest`, `ContactMessage` in
 * src/lib/api/types.ts). The site checks them first (src/lib/quote.ts, src/lib/contact.ts); these are
 * the server's own limits, so nothing oversized or malformed is stored.
 */

const text = (/** @type {number} */ max) => z.string().trim().max(max);
const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

export const quoteSchema = z.object({
  service: z.union([slug, z.literal('')]),
  products: z
    .array(z.object({ slug, quantity: z.number().int().min(1).max(1_000_000), options: z.record(z.string().max(60), z.string().max(120)) }))
    .max(30),
  quantity: z.number().int().min(0).max(1_000_000),
  details: text(4000),
  artwork: z.array(z.object({ name: text(200), size: z.number().int().min(0), type: text(100) })).max(10),
  needsDesign: z.boolean(),
  deadline: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]),
  fulfilment: z.enum(['collect', 'deliver', 'install']),
  location: text(300),
  name: text(120).pipe(z.string().min(2)),
  company: text(120),
  phone: text(30),
  email: text(200),
  preferredContact: z.enum(['whatsapp', 'phone', 'email']),
});

export const messageSchema = z.object({
  name: text(120).pipe(z.string().min(2)),
  phone: text(30),
  email: text(200),
  message: text(4000).pipe(z.string().min(5)),
});

export const STATUSES = /** @type {const} */ (['new', 'in_progress', 'closed']);

export const changeSchema = z
  .object({ status: z.enum(STATUSES).optional(), note: text(2000).optional() })
  .refine((c) => c.status !== undefined || c.note !== undefined, 'Nothing to change.');
