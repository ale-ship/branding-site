// @ts-check
import { timingSafeEqual } from 'node:crypto';
import { notFound } from '../lib/errors.js';

/**
 * Provider callbacks (docs/BACKEND_RUNBOOK.md, section 9): the URL carries an unguessable secret, and
 * a wrong one gets a plain 404 and stores nothing. nginx also allows only Absa's IP ranges on these
 * paths; a signature check joins here if Absa offers one.
 * @param {string} secret
 * @returns {import('express').RequestHandler}
 */
export function providerGuard(secret) {
  const expected = Buffer.from(secret);
  return (req, _res, next) => {
    const given = Buffer.from(String(req.params.secret ?? ''));
    const ok = given.length === expected.length && timingSafeEqual(given, expected);
    next(ok ? undefined : notFound('No such endpoint.'));
  };
}
