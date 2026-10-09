// @ts-check
import { z } from 'zod';
import { addMember, createCompany, removeMember } from './company.service.js';
import { getAccount, getStatement, removeAddress, reorderDraft, saveAddress, saveBrandKit, updateDetails } from './service.js';
import { requestCode, signOut, verifyCode } from './session.service.js';

/**
 * /api/account: customer accounts over HTTP. Only the site's server calls these: it keeps the session
 * in its own httpOnly cookie and passes it on in `X-Account-Session`. Nothing here is cached.
 * @typedef {import('../../deps.js').Deps} Deps
 */

const text = (max = 200) => z.string().max(max);
const codeBody = z.object({ email: text() });
const verifyBody = z.object({ email: text(), code: text(20) });
const detailsBody = z.object({ name: text(), phone: text(40), company: text() });
const companyBody = z.object({ name: text(), kraPin: text(40).default('') });
const memberBody = z.object({ email: text(), name: text(), role: z.enum(['approver', 'member']) });
const ref = z.string().trim().toUpperCase().regex(/^NB-\d{6}$/);

/** @param {import('express').Request} req */
const sessionOf = (req) => req.get('x-account-session') ?? '';

/**
 * A handler answering what `run` returns.
 * @param {(req: import('express').Request) => Promise<unknown>} run
 * @returns {import('express').RequestHandler}
 */
const answer = (run) => async (req, res) => {
  res.set('Cache-Control', 'no-store').json(await run(req));
};

/** @param {Deps} deps */
export const handlers = (deps) => {
  /** @param {import('express').Request} req */
  const d = (req) => ({ ...deps, logger: req.log });
  return {
    postCode: answer((req) => requestCode(d(req), codeBody.parse(req.body).email)),
    postVerify: answer((req) => {
      const { email, code } = verifyBody.parse(req.body);
      return verifyCode(d(req), email, code);
    }),
    postSignOut: answer(async (req) => {
      await signOut(d(req), sessionOf(req));
      return { ok: true };
    }),
    getAccount: answer((req) => getAccount(d(req), sessionOf(req))),
    putDetails: answer((req) => updateDetails(d(req), sessionOf(req), detailsBody.parse(req.body))),
    putBrandKit: answer((req) => saveBrandKit(d(req), sessionOf(req), req.body)),
    postAddress: answer((req) => saveAddress(d(req), sessionOf(req), req.body)),
    deleteAddress: answer((req) => removeAddress(d(req), sessionOf(req), z.string().max(40).parse(req.params.id))),
    getReorder: answer((req) => reorderDraft(d(req), sessionOf(req), ref.parse(req.params.ref))),
    getStatement: answer((req) => getStatement(d(req), sessionOf(req))),
    postCompany: answer((req) => createCompany(d(req), sessionOf(req), companyBody.parse(req.body))),
    postMember: answer((req) => addMember(d(req), sessionOf(req), memberBody.parse(req.body))),
    deleteMember: answer((req) => removeMember(d(req), sessionOf(req), text().parse(req.params.email))),
  };
};
