// @ts-check
import { AppError } from '../lib/errors.js';
import { key } from '../redis.js';

/**
 * Per-IP limits in Redis (`nb:rl:<name>:<ip>`, docs/BACKEND_RUNBOOK.md, section 8.1). A fixed window
 * in one atomic step: INCR, and set the expiry on the first hit.
 */
const HIT = [
  "local n = redis.call('INCR', KEYS[1])",
  "if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "return {n, redis.call('TTL', KEYS[1])}",
].join('\n');

/** @param {import('express').Request} req */
const clientIp = (req) => req.ip || 'unknown';

/**
 * @typedef {object} LimitOptions
 * @property {string} name
 * @property {number} limit
 * @property {number} windowSec
 * @property {(req: import('express').Request) => string} [by]
 * @property {boolean} [failClosed] Refuse when Redis is down (sign-in codes); by default requests go through.
 */

/**
 * Fails open, with a warning, when Redis is unreachable: an outage must not take ordering down.
 * Routes that must never fail open (sign-in codes) pass `failClosed`.
 * @param {Pick<import('ioredis').Redis, 'eval'> | null} redis
 * @param {LimitOptions} options
 * @returns {import('express').RequestHandler}
 */
export function rateLimit(redis, { name, limit, windowSec, by = clientIp, failClosed = false }) {
  return async (req, res, next) => {
    try {
      if (!redis) throw new Error('redis is not configured');
      const bucket = key('rl', name, by(req));
      const [count, ttl] = /** @type {[number, number]} */ (await redis.eval(HIT, 1, bucket, windowSec));
      res.set('RateLimit-Limit', String(limit));
      res.set('RateLimit-Remaining', String(Math.max(limit - count, 0)));
      if (count > limit) {
        const err = new AppError(429, 'rate_limited', 'Too many requests. Please wait a moment and try again.');
        err.retryAfter = Math.max(ttl, 1);
        return next(err);
      }
    } catch (err) {
      if (failClosed) return next(new AppError(503, 'unavailable', 'This is unavailable for a moment. Please try again shortly.'));
      req.log?.warn({ err, limiter: name }, 'rate limiter unavailable, letting the request through');
    }
    next();
  };
}
