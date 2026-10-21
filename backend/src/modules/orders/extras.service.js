// @ts-check
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import * as flow from './flow.js';
import { reportPayment as report } from './payreport.js';
import * as site from './sitejob.js';
import { customerStep } from './steps.service.js';

/**
 * The customer's steps after paying (B5), each on the order page: answer the pre-production sample,
 * ask for finished pieces early, and for site jobs book the survey, accept the firm quote and book
 * the installation. The rules are in flow.js and sitejob.js.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('../../middleware/customerAccess.js').Access} Access
 */

/**
 * @param {Deps} deps @param {string} ref @param {Access} access
 * @param {'approve' | 'changes'} decision @param {string} comments @param {Date} [now]
 */
export const reviewSample = (deps, ref, access, decision, comments, now = new Date()) =>
  customerStep(deps, ref, access, (o) => flow.reviewSample(o, decision, comments), now);

/** @param {Deps} deps @param {string} ref @param {Access} access @param {number} pieces @param {Date} [now] */
export const requestEarlyDelivery = (deps, ref, access, pieces, now = new Date()) =>
  customerStep(deps, ref, access, (o) => flow.requestEarlyDelivery(o, pieces, now), now);

/** @param {Deps} deps @param {string} ref @param {Access} access @param {string} date @param {Date} [now] */
export const bookSurvey = (deps, ref, access, date, now = new Date()) =>
  customerStep(deps, ref, access, (o) => site.bookSurvey(o, date, nairobiToday(now)), now);

/** @param {Deps} deps @param {string} ref @param {Access} access @param {Date} [now] */
export const acceptSiteQuote = (deps, ref, access, now = new Date()) =>
  customerStep(deps, ref, access, (o) => site.acceptQuote(o, nairobiToday(now), now), now);

/** @param {Deps} deps @param {string} ref @param {Access} access @param {string} date @param {Date} [now] */
export const bookInstall = (deps, ref, access, date, now = new Date()) =>
  customerStep(deps, ref, access, (o) => site.bookInstall(o, date, nairobiToday(now)), now);

/**
 * The customer says they've paid by hand, with their M-Pesa code; staff check it and record it.
 * @param {Deps} deps @param {string} ref @param {Access} access
 * @param {string} code @param {number | null} amount @param {Date} [now]
 */
export const reportPayment = (deps, ref, access, code, amount, now = new Date()) =>
  customerStep(deps, ref, access, (o) => report(o, code, amount, now), now);
