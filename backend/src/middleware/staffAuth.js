// @ts-check
import { AppError } from '../lib/errors.js';
import { staffFromToken } from '../modules/staff/service.js';

/**
 * The staff session (docs/BACKEND_RUNBOOK.md, section 4): the `nb_staff` cookie → the staff member
 * and role, on `req.staff`. Changes (anything but GET) must also carry `X-Requested-With: nb-admin`,
 * which a page on another site can't send without our permission, so a forged form post can't act
 * for a signed-in staff member (on top of the SameSite=Strict cookie).
 */

export const STAFF_COOKIE = 'nb_staff';

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
export function staffToken(req) {
  for (const part of (req.get('cookie') ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === STAFF_COOKIE) return decodeURIComponent(value.join('='));
  }
  return '';
}

/**
 * @param {import('../deps.js').Deps} deps
 * @returns {import('express').RequestHandler}
 */
export function requireStaff(deps) {
  return async (req, _res, next) => {
    try {
      if (req.method !== 'GET' && req.get('x-requested-with') !== 'nb-admin') {
        return next(new AppError(403, 'forbidden', 'This request must come from the back office.'));
      }
      const staff = await staffFromToken(deps, staffToken(req));
      if (!staff) return next(new AppError(401, 'unauthorised', 'Please sign in.'));
      /** @type {any} */ (req).staff = staff;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Only these roles (admin always may).
 * @param {...import('../modules/staff/service.js').Role} roles
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    const role = /** @type {any} */ (req).staff?.role;
    if (role === 'admin' || roles.includes(role)) return next();
    next(new AppError(403, 'forbidden', 'Your role can’t do that.'));
  };
}

/**
 * The signed-in staff member (after `requireStaff`).
 * @param {import('express').Request} req
 * @returns {import('../modules/staff/repo.js').Staff}
 */
export const staffOf = (req) => /** @type {any} */ (req).staff;
