// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { buildSiteQuote, installDateError } from '@noorcom-branding/shared/rules/site-quote.js';

/**
 * Site jobs (Mechanism B), pure like backoffice/steps.js, as the site's mock runs them
 * (src/lib/api/mock-orders.ts):
 *
 *   survey fee paid (in_design) → the customer books the survey date → staff survey and send the firm
 *   quote (the quote builder) → the customer accepts it: the deposit falls due (awaiting_payment) →
 *   paid: design and proof as usual → approved: in production ("Design approved") → the customer books
 *   the installation date → staff tick the stages (materials printed, installed) → "Signed off": the
 *   balance falls due, the survey fee already off it → paid: completed.
 *
 * @typedef {Record<string, any>} Row
 * @typedef {import('../backoffice/steps.js').Step} Step
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').SiteQuoteItem} SiteQuoteItem
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').PriceLine} PriceLine
 */

const kes = (/** @type {number} */ n) => `KES ${n.toLocaleString('en-KE')}`;

/**
 * The progress with `name` ticked (once).
 * @param {Row} o
 * @param {string} name
 */
function tick(o, name) {
  const p = o.progress;
  if (p?.kind !== 'stages') return p;
  const stages = p.stages.map((/** @type {{ name: string; done: boolean }} */ s) => (s.name === name ? { ...s, done: true } : s));
  return { ...p, stages, done: stages.filter((/** @type {{ done: boolean }} */ s) => s.done).length };
}

/** @param {Row} o */
function siteJob(o) {
  if (o.mechanism !== 'B') throw new OrderError('invalid_state', 'Only site jobs have a survey, a firm quote and an installation.');
}

/**
 * @param {Row} o
 * @param {string} date
 * @param {string} today
 * @returns {Step}
 */
export function bookSurvey(o, date, today) {
  siteJob(o);
  if (o.status !== 'in_design') throw new OrderError('invalid_state', 'Pay the survey fee first.');
  if (o.site_quote) throw new OrderError('invalid_state', 'The survey is done.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today) throw new OrderError('invalid', 'Choose a date from tomorrow on.');
  const moved = !!o.survey?.booked;
  return {
    fields: { survey: { ...(o.survey ?? { preferred: [] }), booked: date } },
    events: [`Survey ${moved ? 'moved to' : 'booked for'} ${date}.`],
    message: { template: 'survey-booked', text: `Your site survey for ${o.order_no} is ${moved ? 'moved to' : 'booked for'} ${date}. Our surveyor will call before coming.` },
    audit: { date },
  };
}

/**
 * Staff send the firm quote after the survey (a new one replaces one not yet accepted).
 * @param {Row} o
 * @param {{ items: SiteQuoteItem[]; extras: PriceLine[]; notes: string }} q
 * @param {string} today
 * @param {Date} now
 * @returns {Step}
 */
export function issueQuote(o, { items, extras, notes }, today, now) {
  siteJob(o);
  if (o.status !== 'in_design' || o.site_quote?.status === 'accepted') throw new OrderError('invalid_state', 'A firm quote is sent after the survey, before it is accepted.');
  if (!o.survey?.booked) throw new OrderError('invalid_state', 'The survey date isn’t booked yet.');
  /** @type {ReturnType<typeof buildSiteQuote>} */
  let built;
  try {
    built = buildSiteQuote(items, extras, today);
  } catch (e) {
    throw new OrderError('invalid', /** @type {Error} */ (e).message);
  }
  const quote = { issuedAt: now.toISOString(), validUntil: built.validUntil, status: 'pending', acceptedAt: null, surveyNotes: notes.trim(), items, lines: built.lines, total: built.total, deposit: built.deposit };
  return {
    fields: { site_quote: quote, progress: tick(o, 'Survey') },
    events: [`Survey done. Firm quote: ${kes(built.total)}.`],
    message: { template: 'site-quote', text: `Your firm quote for ${o.order_no} is ready: ${kes(built.total)}. Accept it on your order page.` },
    audit: { total: built.total, items: items.length },
  };
}

/**
 * The customer accepts the firm quote: it becomes the order's total and the deposit falls due.
 * @param {Row} o
 * @param {string} today
 * @param {Date} now
 * @returns {Step}
 */
export function acceptQuote(o, today, now) {
  siteJob(o);
  const q = o.site_quote;
  if (o.status !== 'in_design' || q?.status !== 'pending') throw new OrderError('invalid_state', 'There’s no quote waiting for you.');
  if (q.validUntil < today) throw new OrderError('invalid_state', 'This quote has expired; WhatsApp us and we’ll refresh it.');
  return {
    fields: {
      site_quote: { ...q, status: 'accepted', acceptedAt: now.toISOString() },
      total: q.total,
      progress: tick(o, 'Firm quote accepted'),
      status: 'awaiting_payment',
      due_now: q.deposit,
      due_purpose: 'deposit',
    },
    events: [`Quote of ${kes(q.total)} accepted. Pay the deposit of ${kes(q.deposit)} to start the design.`],
    message: { template: 'quote-accepted', text: `Thank you for accepting the quote for ${o.order_no}. Pay the deposit of ${kes(q.deposit)} to start.` },
    audit: {},
  };
}

/**
 * The customer books (or moves) the installation date while the job is in production.
 * @param {Row} o
 * @param {string} date
 * @param {string} today
 * @returns {Step}
 */
export function bookInstall(o, date, today) {
  siteJob(o);
  if (o.status !== 'in_production') throw new OrderError('invalid_state', 'Installation is booked once the design is approved.');
  const stages = o.progress?.stages ?? [];
  if (stages.find((/** @type {{ name: string; done: boolean }} */ s) => s.name === 'Installed')?.done) throw new OrderError('invalid_state', 'The installation is done.');
  const problem = installDateError(date, today);
  if (problem) throw new OrderError('invalid', problem);
  const moved = !!o.install_date;
  // The stage counts once everything before it is done; until then the date is simply kept.
  const i = stages.findIndex((/** @type {{ name: string }} */ s) => s.name === 'Installation scheduled');
  const ready = i >= 0 && stages.slice(0, i).every((/** @type {{ done: boolean }} */ s) => s.done);
  return {
    fields: { install_date: date, ...(ready ? { progress: tick(o, 'Installation scheduled') } : {}) },
    events: [`Installation ${moved ? 'moved to' : 'booked for'} ${date}.`],
    message: { template: 'install-booked', text: `Installation for ${o.order_no} is ${moved ? 'moved to' : 'booked for'} ${date}. Our team will call the day before.` },
    audit: { date },
  };
}

/**
 * Staff tick the next stage of a site job in production. "Signed off" closes the work: the balance
 * falls due (or the job completes when nothing is left to pay).
 * @param {Row} o
 * @param {Date} now
 * @returns {Step}
 */
export function nextStage(o, now) {
  siteJob(o);
  if (o.status !== 'in_production') throw new OrderError('invalid_state', 'Stages are ticked while the job is in production.');
  const next = o.progress?.stages?.find((/** @type {{ done: boolean }} */ s) => !s.done);
  if (!next) throw new OrderError('invalid_state', 'Every stage is done.');
  if (next.name === 'Installation scheduled' && !o.install_date) throw new OrderError('invalid_state', 'Waiting for the customer to choose an installation date.');
  let progress = tick(o, next.name);
  if (next.name !== 'Signed off') {
    // A date chosen early: the scheduled stage follows as soon as it is reached.
    const after = progress.stages.find((/** @type {{ done: boolean }} */ s) => !s.done);
    if (after?.name === 'Installation scheduled' && o.install_date) progress = tick({ ...o, progress }, 'Installation scheduled');
    return { fields: { progress }, events: [`${next.name}: done.`], message: null, audit: { stage: next.name } };
  }
  const handedOver = { at: now.toISOString(), method: 'install', detail: `Installed and signed off on site by ${o.customer_name}.`, recipient: null };
  const balance = (o.total ?? 0) - o.amount_paid;
  if (balance > 0) {
    return {
      fields: { progress, handed_over: handedOver, status: 'awaiting_balance', due_now: balance, due_purpose: 'balance' },
      events: [`Signed off. Pay the balance of ${kes(balance)} (the survey fee is already taken off).`],
      message: { template: 'balance-due', text: `Thank you for signing off ${o.order_no}. The balance is ${kes(balance)}: pay it on your order page.` },
      audit: { stage: next.name, balance },
    };
  }
  return {
    fields: { progress, handed_over: handedOver, status: 'completed' },
    events: ['Installed and signed off.', 'Order complete. Thank you!'],
    message: { template: 'completed', text: `${o.order_no} is installed and signed off. Thank you for working with Noorcom Branding!` },
    audit: { stage: next.name },
  };
}
