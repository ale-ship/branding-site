// @ts-check
import { z } from 'zod';
import { STAFF_COOKIE, staffOf, staffToken } from '../../middleware/staffAuth.js';
import { addStaff, listStaff, ROLES, SESSION_DAYS, signIn, signOut, updateStaff } from './service.js';

/**
 * Staff sign-in and staff accounts over HTTP. The cookie is httpOnly, SameSite=Strict, Secure in
 * production and scoped to /api/staff: nothing else on the site ever sees it.
 * @typedef {import('../../deps.js').Deps} Deps
 */

const signInSchema = z.object({ email: z.string().trim().min(3).max(200), password: z.string().min(1).max(200) });
const role = z.enum(ROLES);
const newStaffSchema = z.object({ email: z.string().trim().min(3).max(200), name: z.string().trim().min(1).max(120), role, password: z.string().max(200) });
const changeSchema = z
  .object({ name: z.string().trim().min(1).max(120), role, active: z.boolean(), password: z.string().max(200) })
  .partial();

/** @param {Deps} deps */
const cookieOptions = (deps) => ({
  httpOnly: true,
  sameSite: /** @type {const} */ ('strict'),
  secure: deps.config?.env === 'production',
  path: '/api/staff',
  maxAge: SESSION_DAYS * 86_400_000,
});

/**
 * POST /api/staff/auth/sign-in `{ email, password }`
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postSignIn = (deps) => async (req, res) => {
  const { email, password } = signInSchema.parse(req.body);
  const { token, staff } = await signIn(deps, email, password);
  res.cookie(STAFF_COOKIE, token, cookieOptions(deps)).set('Cache-Control', 'no-store').json({ staff });
};

/**
 * POST /api/staff/auth/sign-out
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postSignOut = (deps) => async (req, res) => {
  await signOut(deps, staffToken(req));
  res.clearCookie(STAFF_COOKIE, { ...cookieOptions(deps), maxAge: undefined }).status(204).end();
};

/**
 * GET /api/staff/me
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function getMe(req, res) {
  res.set('Cache-Control', 'no-store').json({ staff: staffOf(req) });
}

/**
 * GET /api/staff/users (admin)
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const getUsers = (deps) => async (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ users: await listStaff(deps) });
};

/**
 * POST /api/staff/users (admin)
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const postUser = (deps) => async (req, res) => {
  res.status(201).json({ user: await addStaff(deps, staffOf(req), newStaffSchema.parse(req.body)) });
};

/**
 * PATCH /api/staff/users/:id (admin)
 * @param {Deps} deps
 * @returns {import('express').RequestHandler}
 */
export const patchUser = (deps) => async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json({ user: await updateStaff(deps, staffOf(req), id, changeSchema.parse(req.body)) });
};
