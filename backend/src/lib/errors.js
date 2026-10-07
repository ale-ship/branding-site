// @ts-check
import { ZodError } from 'zod';
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';

/**
 * Errors on the wire are always `{ error, message, details? }`; `message` is written for a customer,
 * and nothing about the server leaks into a 500 (docs/BACKEND_RUNBOOK.md, section 9).
 */

export class AppError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {unknown} [details]
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    /** @type {number | undefined} Seconds, for 429 answers. */
    this.retryAfter = undefined;
  }
}

/** @param {string} [message] */
export const notFound = (message = 'We could not find that.') => new AppError(404, 'not_found', message);
/** @param {string} message @param {unknown} [details] */
export const invalid = (message, details) => new AppError(400, 'invalid', message, details);

/**
 * The shared rules' OrderError codes, as HTTP statuses.
 * @type {Record<string, number>}
 */
const ORDER_STATUS = { not_found: 404, invalid: 400, invalid_state: 409 };

/**
 * A zod validation error, from any copy of zod: shared/contract's schemas and the backend can load
 * different copies (npm can't hoist one zod 3 beside the root's zod 4), so `instanceof` isn't enough.
 * @param {unknown} err
 * @returns {err is ZodError}
 */
function isZodError(err) {
  return err instanceof ZodError || (err instanceof Error && err.name === 'ZodError' && Array.isArray(/** @type {any} */ (err).issues));
}

/**
 * @param {unknown} err
 * @returns {AppError}
 */
function normalise(err) {
  if (err instanceof AppError) return err;
  if (err instanceof OrderError) return new AppError(ORDER_STATUS[err.code] ?? 400, err.code, err.message);
  if (isZodError(err)) {
    const fields = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return invalid('Some of the details are not valid.', { fields });
  }
  const e = /** @type {{ type?: string; status?: number; statusCode?: number; expose?: boolean } | null} */ (err && typeof err === 'object' ? err : null);
  if (e?.type === 'entity.parse.failed') return invalid('The request body is not valid JSON.');
  if (e?.type === 'entity.too.large') return new AppError(413, 'invalid', 'The request is too large.');
  // A client error raised by Express middleware keeps its status; its own message is never passed on.
  const status = e?.status ?? e?.statusCode;
  if (status === 404) return notFound();
  if (e?.expose && status && status >= 400 && status < 500) return new AppError(status, 'invalid', 'That request is not valid.');
  return new AppError(500, 'internal_error', 'Something went wrong on our side. Please try again.');
}

/** @type {import('express').RequestHandler} */
export const notFoundHandler = (_req, _res, next) => {
  return next(notFound('No such endpoint.'));
};

/** @type {import('express').ErrorRequestHandler} */
export const errorHandler = (err, req, res, next) => {
  const e = normalise(err);
  if (e.status >= 500) req.log?.error({ err }, 'request failed');
  if (res.headersSent) {
    next(err);
    return;
  }
  /** @type {{ error: string; message: string; details?: unknown }} */
  const body = { error: e.code, message: e.message };
  if (e.details !== undefined) body.details = e.details;
  if (e.retryAfter) res.set('Retry-After', String(e.retryAfter));
  res.status(e.status).set('Cache-Control', 'no-store').json(body);
};
