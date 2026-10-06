// @ts-check
import { randomUUID } from 'node:crypto';

const ACCEPTED = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Gives every request an id (kept from the site or nginx when it sent a sane one), a child logger
 * carrying it, and one access line when the response ends. The query string is left out on purpose:
 * it can hold personal data.
 * @param {import('../lib/logger.js').Logger} logger
 * @returns {import('express').RequestHandler}
 */
export function requestContext(logger) {
  return (req, res, next) => {
    const sent = req.get('x-request-id');
    req.id = sent && ACCEPTED.test(sent) ? sent : randomUUID();
    req.log = logger.child({ reqId: req.id });
    res.set('X-Request-Id', req.id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      req.log.info({ method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) }, 'request');
    });
    next();
  };
}
