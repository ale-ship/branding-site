// @ts-check
import { z } from 'zod';
import { accountList, statement } from './accounts.service.js';
import { asFile } from './files.js';
import { KINDS, report } from './service.js';

/**
 * The reports and customer accounts endpoints: JSON for the back office's screens, or the same
 * document as a PDF or CSV download (`?format=pdf|csv`).
 * @typedef {import('../../deps.js').Deps} Deps
 */

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), 'Not a real date.');
const periodQuery = z.object({ from: ymd.optional(), to: ymd.optional(), format: z.enum(['json', 'pdf', 'csv']).default('json') });
const kind = z.enum(KINDS);
const accountsQuery = z.object({ q: z.string().max(100).default('') });
const email = z.string().trim().email().max(200);

/**
 * Answers with the document as JSON, or as a file named after it.
 * @param {import('express').Response} res
 * @param {import('./service.js').Report} doc
 * @param {'json' | 'pdf' | 'csv'} format
 * @param {string} name
 */
async function send(res, doc, format, name) {
  res.set('Cache-Control', 'no-store');
  if (format === 'json') return void res.json({ report: doc });
  const file = await asFile(doc, format);
  res.set('Content-Type', file.type);
  res.set('Content-Disposition', `attachment; filename="${name}.${format}"`);
  res.send(file.body);
}

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getReport = (deps) => async (req, res) => {
  const k = kind.parse(req.params.kind);
  const { format, ...q } = periodQuery.parse(req.query);
  const doc = await report(deps, k, q);
  await send(res, doc, format, `noorcom-${k}-${doc.period.from}-to-${doc.period.to}`);
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getAccounts = (deps) => async (req, res) => {
  res.set('Cache-Control', 'no-store').json({ accounts: await accountList(deps, accountsQuery.parse(req.query).q) });
};

/** @param {Deps} deps @returns {import('express').RequestHandler} */
export const getStatement = (deps) => async (req, res) => {
  const { format, ...q } = periodQuery.parse(req.query);
  const doc = await statement(deps, email.parse(req.query.email), q);
  const who = (doc.customer.email.split('@')[0] ?? 'customer').replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
  await send(res, doc, format, `noorcom-statement-${who}-${doc.period.from}-to-${doc.period.to}`);
};
