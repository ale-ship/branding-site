// @ts-check
import { randomInt } from 'node:crypto';
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { normaliseEmail } from '@noorcom-branding/shared/rules/account.js';
import { normaliseKenyanPhone } from '@noorcom-branding/shared/rules/phone.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { queueNotifications } from '../notifications/service.js';
import { audit } from '../staff/repo.js';
import * as repo from './repo.js';

/**
 * Requests (B5): the site's quote form ("ask us first") and contact form, kept for staff in the back
 * office's inbox. Each one is stored with a reference (NQ- for quotes, NM- for messages); staff get an
 * email at STAFF_INBOX and the customer an acknowledgement, both through the outbox. Staff move a
 * request from new to in progress to closed and keep a note; every change is audited.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 * @typedef {import('zod').infer<typeof import('./schemas.js').quoteSchema>} QuoteInput
 * @typedef {import('zod').infer<typeof import('./schemas.js').messageSchema>} MessageInput
 * @typedef {Record<string, any>} Row
 */

const FULFILMENT = { collect: 'Collect from the shop', deliver: 'Deliver', install: 'Install on site' };
const CONTACT = { whatsapp: 'WhatsApp', phone: 'a call', email: 'email' };

/** @param {Deps} deps */
function need(deps) {
  if (!deps.pool) throw new AppError(503, 'unavailable', 'We couldn’t take your request just now. Please try again, or WhatsApp us.');
  return deps.pool;
}

/**
 * @param {string} rawPhone
 * @param {string} rawEmail
 */
function contactOf(rawPhone, rawEmail) {
  const phone = rawPhone ? normaliseKenyanPhone(rawPhone) : '';
  if (phone === null) throw new OrderError('invalid', 'Check your phone number, like 0722 530 301.');
  const email = rawEmail ? normaliseEmail(rawEmail) : '';
  if (email === null) throw new OrderError('invalid', 'Check your email address.');
  if (!phone && !email) throw new OrderError('invalid', 'Leave a phone number or an email so we can reply.');
  return { phone, email };
}

/**
 * A request with the website's names beside the slugs (a service or product renamed or removed keeps its slug).
 * @param {Map<string, string>} names
 * @param {Row} data
 */
const named = (names, data) =>
  data.service === undefined
    ? data
    : {
        ...data,
        serviceName: data.service ? (names.get(`service:${data.service}`) ?? data.service) : '',
        products: data.products.map((/** @type {Row} */ p) => ({ ...p, name: names.get(`product:${p.slug}`) ?? p.slug })),
      };

/**
 * The staff email's words for a quote request.
 * @param {string} ref
 * @param {QuoteInput & { serviceName: string; products: Array<QuoteInput['products'][number] & { name: string }> }} q
 */
function quoteText(ref, q) {
  const lines = [`New quote request ${ref} from ${q.name}${q.company ? `, ${q.company}` : ''}.`, ''];
  if (q.service) lines.push(`Service: ${q.serviceName}${q.quantity ? `, ${q.quantity} pieces` : ''}`);
  for (const p of q.products) lines.push(`Shop item: ${p.name} × ${p.quantity}${Object.keys(p.options).length ? ` (${Object.entries(p.options).map(([k, v]) => `${k}: ${v}`).join(', ')})` : ''}`);
  if (q.details) lines.push('', q.details, '');
  lines.push(`Design: ${q.needsDesign ? 'they need us to design it' : 'they have artwork'}${q.artwork.length ? ` (${q.artwork.map((a) => a.name).join(', ')})` : ''}`);
  lines.push(`Deadline: ${q.deadline || 'no fixed date'}`, `Handover: ${FULFILMENT[q.fulfilment]}${q.location ? `, ${q.location}` : ''}`);
  lines.push('', `Reply by ${CONTACT[q.preferredContact]}: ${[q.phone, q.email].filter(Boolean).join(' · ')}`, 'Open it in the back office under Requests.');
  return lines.join('\n');
}

/**
 * Stores a request and queues the two emails, in one transaction.
 * @param {Deps} deps
 * @param {{ kind: 'quote' | 'message'; name: string; company: string; phone: string; email: string; preferredContact: string; data: unknown; staffText: (ref: string) => string }} r
 * @param {Date} now
 */
async function store(deps, r, now) {
  const prefix = r.kind === 'quote' ? 'NQ' : 'NM';
  const inbox = deps.config?.mail.staffInbox ?? 'info@noorcombranding.co.ke';
  const placed = await withTransaction(need(deps), async (trx) => {
    let ref = '';
    for (let tries = 0; !ref && tries < 10; tries++) {
      const draw = `${prefix}-${randomInt(100000, 1000000)}`;
      if ((await repo.insertRequest(trx, { ...r, ref: draw, at: now })) !== null) ref = draw;
    }
    if (!ref) throw new Error('no free request reference after 10 draws');
    const first = r.name.trim().split(/\s+/)[0];
    const what = r.kind === 'quote' ? 'quote request' : 'message';
    const ids = await repo.insertMessages(
      trx,
      [
        { channel: 'email', recipient: inbox, template: r.kind === 'quote' ? 'request-quote' : 'request-message', payload: { ref, text: r.staffText(ref) } },
        ...(r.email
          ? [{ channel: /** @type {const} */ ('email'), recipient: r.email, template: 'request-received', payload: { ref, text: `Thank you, ${first}. We’ve got your ${what}, reference ${ref}, and we’ll reply within one working day.` } }]
          : []),
      ],
      now,
    );
    return { ref, ids };
  });
  await queueNotifications(deps, placed.ids);
  deps.logger?.info({ ref: placed.ref }, `${r.kind} request received`);
  return { reference: placed.ref };
}

/**
 * @param {Deps} deps
 * @param {QuoteInput} q
 * @param {Date} [now]
 */
export async function submitQuote(deps, q, now = new Date()) {
  if (!q.service && !q.products.length) throw new OrderError('invalid', 'Choose a service or add items from the shop.');
  const contact = contactOf(q.phone, q.email);
  const data = { ...q, ...contact };
  const names = await repo.contentNames(need(deps));
  return store(deps, { kind: 'quote', name: q.name, company: q.company, ...contact, preferredContact: q.preferredContact, data, staffText: (ref) => quoteText(ref, /** @type {any} */ (named(names, data))) }, now);
}

/**
 * @param {Deps} deps
 * @param {MessageInput} m
 * @param {Date} [now]
 */
export async function sendMessage(deps, m, now = new Date()) {
  const contact = contactOf(m.phone, m.email);
  const staffText = (/** @type {string} */ ref) =>
    [`New message ${ref} from ${m.name}.`, '', m.message, '', `Reply: ${[contact.phone, contact.email].filter(Boolean).join(' · ')}`, 'Open it in the back office under Requests.'].join('\n');
  return store(deps, { kind: 'message', name: m.name, company: '', ...contact, preferredContact: contact.phone ? 'whatsapp' : 'email', data: { ...m, ...contact }, staffText }, now);
}

/** @param {Row} r @param {Map<string, string>} names */
const view = (r, names) => ({
  ref: r.ref,
  kind: r.kind,
  status: r.status,
  name: r.name,
  company: r.company,
  phone: r.phone,
  email: r.email,
  preferredContact: r.preferred_contact,
  data: named(names, r.data),
  note: r.staff_note,
  handledBy: r.handled_by_name ?? null,
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
});

/**
 * @param {Deps} deps
 * @param {{ status?: string; q?: string }} f
 */
export async function listRequests(deps, f) {
  const [rows, names] = await Promise.all([repo.listRequests(need(deps), { status: f.status, q: f.q?.trim() || undefined }), repo.contentNames(need(deps))]);
  return rows.map((r) => view(r, names));
}

/**
 * @param {Deps} deps
 * @param {string} ref
 */
export async function getRequest(deps, ref) {
  const r = await repo.findRequest(need(deps), ref.toUpperCase());
  if (!r) throw new AppError(404, 'not_found', 'No such request.');
  return view(r, await repo.contentNames(need(deps)));
}

/**
 * @param {Deps} deps
 * @param {{ id: number }} actor
 * @param {string} ref
 * @param {{ status?: string; note?: string }} change
 */
export async function changeRequest(deps, actor, ref, change) {
  const pool = need(deps);
  if (!(await repo.updateRequest(pool, ref.toUpperCase(), { ...change, staffId: actor.id }))) throw new AppError(404, 'not_found', 'No such request.');
  await audit(pool, actor.id, 'request-updated', null, { ref: ref.toUpperCase(), ...change });
  return getRequest(deps, ref);
}
