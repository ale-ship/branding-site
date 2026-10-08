// @ts-check
import { stkRequestSchema } from '@noorcom-branding/shared/contract/schemas.js';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { accessFrom } from '../../middleware/customerAccess.js';
import { receiveC2B } from './c2b.service.js';
import { receiveStkCallback, startStk } from './service.js';

/**
 * Payments over HTTP: the customer's prompt, Absa's callbacks, and (fake mode only) a Paybill payment
 * made up for testing.
 * @typedef {import('../../deps.js').Deps} Deps
 */

/** What Absa expects back from a callback or validation: accepted, always. */
const ACCEPTED = { ResultCode: 0, ResultDesc: 'Accepted' };

/**
 * POST /api/payments/stk `{ ref, phone }`, with the order's access in a header.
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postStk = (deps) => async (req, res) => {
  const { ref, phone } = stkRequestSchema.parse(req.body);
  res.set('Cache-Control', 'no-store').json(await startStk({ ...deps, logger: req.log }, ref, accessFrom(req), phone));
};

/**
 * POST /api/payments/absa/stk/:secret
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postStkCallback = (deps) => async (req, res) => {
  await receiveStkCallback({ ...deps, logger: req.log }, req.body);
  res.json(ACCEPTED);
};

/**
 * POST /api/payments/absa/c2b/confirm/:secret
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postC2BConfirmation = (deps) => async (req, res) => {
  await receiveC2B({ ...deps, logger: req.log }, req.body);
  res.json(ACCEPTED);
};

/**
 * POST /api/payments/absa/c2b/validate/:secret: every payment is accepted (rejecting one bounces the
 * customer's money); routing happens after the confirmation.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 */
export function postC2BValidation(_req, res) {
  res.json(ACCEPTED);
}

const devC2BSchema = z.object({
  ref: z.string().trim().toUpperCase().regex(/^NB-\d{6}$/).optional(),
  billRef: z.string().max(100).optional(),
  amount: z.number().int().min(1).max(10_000_000),
  phone: z.string().regex(/^2547\d{8}$|^2541\d{8}$/).optional(),
});

/**
 * POST /api/dev/c2b (fake mode only): a Paybill payment as Absa would confirm it, through the real
 * confirmation path. `{ ref, amount }` pays an order by its number; `billRef` and `phone` try the
 * other routes.
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postDevC2B = (deps) => async (req, res) => {
  const { ref, billRef, amount, phone } = devC2BSchema.parse(req.body);
  const transId = `TST${randomInt(1_000_000, 10_000_000)}`;
  const body = {
    TransactionType: 'Pay Bill',
    TransID: transId,
    TransTime: new Date().toISOString().replace(/\D/g, '').slice(0, 14),
    TransAmount: String(amount),
    BusinessShortCode: deps.config?.absa.paybill ?? '303030',
    BillRefNumber: billRef ?? (ref ? `2055268420#${ref}` : ''),
    MSISDN: phone ?? '254700000000',
    FirstName: 'Test',
  };
  const { stored } = await receiveC2B({ ...deps, logger: req.log }, body);
  res.status(201).json({ transId, stored });
};
