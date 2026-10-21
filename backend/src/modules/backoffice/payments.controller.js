// @ts-check
import { PAYMENT_CHANNELS } from '@noorcom-branding/shared/rules/manual-payment.js';
import { z } from 'zod';
import { staffOf } from '../../middleware/staffAuth.js';
import { recordPayment } from './payments.service.js';

/**
 * POST /api/staff/orders/:no/payments: a payment recorded by hand, `{ amount, channel, reference,
 * paidOn }`; answers with the order as staff see it.
 * @typedef {import('../../deps.js').Deps} Deps
 */

const body = z.object({
  amount: z.number().int().min(1).max(100_000_000),
  channel: z.enum(PAYMENT_CHANNELS),
  reference: z.string().max(40).default(''),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date it was paid.'),
});

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const postPayment = (deps) => async (req, res) => {
  const ref = z.string().regex(/^NB-\d{6}$/i).parse(req.params.no);
  res.set('Cache-Control', 'no-store').json(await recordPayment(deps, staffOf(req), ref, body.parse(req.body)));
};
