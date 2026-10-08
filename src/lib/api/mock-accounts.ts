import { CODE_LENGTH, CODE_MAX_TRIES, CODE_RESEND_SECONDS, CODE_TTL_MINUTES, isCode, maskEmail, MAX_ADDRESSES, normaliseEmail, SESSION_DAYS } from '../account';
import { normaliseKenyanPhone } from '../quote';
import { buildStatement } from '../statement';
import { companies, companyOf } from './mock-companies';
import { clock, getOrderForStatement, orders } from './mock-orders';
import { OrderError, type Account, type AccountSession, type BrandKit, type CompanyMember, type OrderSummary, type ReorderDraft, type SavedAddress, type Statement } from './order-types';
import { shared } from './mock-store';

/**
 * The mock accounts: what our backend will do, in memory (docs/ORDER_WORKFLOW_SPEC.md, "Accounts").
 *
 * - Sign-in is a six-digit code emailed to the customer (owner, 7 Oct 2026: email is free). Codes
 *   last ten minutes, allow five tries and can be resent after a minute. The mock hands the code back
 *   so it can be tried; the backend never does.
 * - An account is its verified email: every order placed with that email shows in it, guest orders
 *   included, so nothing needs claiming. The phone is a detail, for M-Pesa and delivery.
 * - Sessions are random tokens kept in an httpOnly cookie by the site, for thirty days.
 */

type Profile = { name: string; phone: string; company: string; brandKit: BrandKit | null; addresses: SavedAddress[] };
type Code = { code: string; expiresAt: number; tries: number; sentAt: number };

const profiles = shared('profiles', () => new Map<string, Profile>());
const codes = shared('codes', () => new Map<string, Code>());
const sessions = shared('sessions', () => new Map<string, { email: string; expiresAt: number }>());

const randomDigits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

function emailOf(raw: string): string {
  const email = normaliseEmail(raw);
  if (!email) throw new OrderError('invalid', 'Enter your email address, like you@company.co.ke.');
  return email;
}

/** Orders belong to the account whose email they were placed with. */
const placedBy = (o: { customer: { email: string } }, email: string) => normaliseEmail(o.customer.email) === email;

function sessionEmail(session: string): string {
  const s = sessions.get(session);
  if (!s || s.expiresAt < clock.now()) {
    sessions.delete(session);
    throw new OrderError('not_found', 'Please sign in again.');
  }
  return s.email;
}

function profileFor(email: string): Profile {
  let p = profiles.get(email);
  if (!p) {
    // A new account starts from the customer's latest order, so they don't type it all again.
    const last = [...orders.values()].filter((o) => placedBy(o, email)).at(-1);
    p = { name: last?.customer.name ?? '', phone: last?.customer.phone ?? '', company: last?.customer.company ?? '', brandKit: null, addresses: [] };
    profiles.set(email, p);
  }
  return p;
}

const canReorder = (o: { mechanism: string; proofs: { status: string }[]; status: string }) =>
  o.mechanism === 'A' && o.proofs.some((p) => p.status === 'approved') && !['expired', 'cancelled'].includes(o.status);

const summary = (o: (typeof orders extends Map<string, infer V> ? V : never)): OrderSummary => ({
  ref: o.ref,
  createdAt: o.createdAt,
  status: o.status,
  productName: o.product.name,
  productSlug: o.product.slug,
  mechanism: o.mechanism,
  quantity: o.quantity,
  total: o.total,
  amountPaid: o.amountPaid,
  invoiceNo: o.invoiceNo,
  canReorder: canReorder(o),
});

function account(email: string): Account {
  const p = profileFor(email);
  const mine = [...orders.values()].filter((o) => placedBy(o, email)).reverse();
  const company = companyOf(email);
  const companyOrders =
    company && company.role !== 'member'
      ? [...orders.values()]
          .filter((o) => o.company?.id === company.id && !placedBy(o, email))
          .reverse()
          .map((o) => ({ ...summary(o), placedBy: o.customer.name }))
      : [];
  const summaries: OrderSummary[] = mine.map((o) => ({
    ref: o.ref,
    createdAt: o.createdAt,
    status: o.status,
    productName: o.product.name,
    productSlug: o.product.slug,
    mechanism: o.mechanism,
    quantity: o.quantity,
    total: o.total,
    amountPaid: o.amountPaid,
    invoiceNo: o.invoiceNo,
    canReorder: canReorder(o),
  }));
  // Details not filled in yet come from the latest order.
  const latest = mine[0]?.customer;
  const details = { name: p.name || latest?.name || '', phone: p.phone || latest?.phone || '', company: p.company || latest?.company || '' };
  return { email, ...structuredClone(p), ...details, orders: summaries, credit: mine.reduce((s, o) => s + o.credit, 0), companyAccount: company, companyOrders };
}

export function requestSignInCode(rawEmail: string): { sentTo: string; demoCode?: string } {
  const email = emailOf(rawEmail);
  const now = clock.now();
  const previous = codes.get(email);
  if (previous && now - previous.sentAt < CODE_RESEND_SECONDS * 1000) {
    throw new OrderError('invalid', `We’ve just sent a code. You can ask for another in ${Math.ceil((CODE_RESEND_SECONDS * 1000 - (now - previous.sentAt)) / 1000)} seconds.`);
  }
  const code = randomDigits(CODE_LENGTH);
  codes.set(email, { code, expiresAt: now + CODE_TTL_MINUTES * 60_000, tries: 0, sentAt: now });
  return { sentTo: maskEmail(email), demoCode: code };
}

export function verifySignInCode(rawEmail: string, rawCode: string): AccountSession {
  const email = emailOf(rawEmail);
  const entry = codes.get(email);
  const wrong = new OrderError('invalid', 'That code isn’t right, or it has expired. Ask for a new one.');
  if (!entry || entry.expiresAt < clock.now() || entry.tries >= CODE_MAX_TRIES) throw wrong;
  entry.tries++;
  if (!isCode(rawCode) || rawCode.trim() !== entry.code) throw wrong;
  codes.delete(email);
  const session = crypto.randomUUID().replace(/-/g, '') + randomDigits(8);
  sessions.set(session, { email, expiresAt: clock.now() + SESSION_DAYS * 86_400_000 });
  profileFor(email);
  return { session };
}

export function getAccount(session: string): Account | null {
  try {
    return account(sessionEmail(session));
  } catch {
    return null;
  }
}

export function updateAccount(session: string, details: { name: string; phone: string; company: string }): Account {
  const email = sessionEmail(session);
  const p = profileFor(email);
  if (details.name.trim().length < 2) throw new OrderError('invalid', 'Enter your name.');
  const phone = details.phone.trim() ? normaliseKenyanPhone(details.phone) : '';
  if (phone === null) throw new OrderError('invalid', 'Check your phone number, like 0722 530 301.');
  Object.assign(p, { name: details.name.trim().slice(0, 100), phone, company: details.company.trim().slice(0, 120) });
  return account(email);
}

export function saveBrandKit(session: string, kit: BrandKit): Account {
  const email = sessionEmail(session);
  profileFor(email).brandKit = structuredClone(kit);
  return account(email);
}

export function saveAddress(session: string, address: Omit<SavedAddress, 'id'> & { id?: string }): Account {
  const email = sessionEmail(session);
  const p = profileFor(email);
  const existing = address.id ? p.addresses.find((a) => a.id === address.id) : undefined;
  if (existing) Object.assign(existing, { label: address.label, address: address.address, zone: address.zone });
  else {
    if (p.addresses.length >= MAX_ADDRESSES) throw new OrderError('invalid', `Up to ${MAX_ADDRESSES} addresses; remove one first.`);
    p.addresses.push({ id: `ADR-${randomDigits(6)}`, label: address.label, address: address.address, zone: address.zone });
  }
  return account(email);
}

export function removeAddress(session: string, id: string): Account {
  const email = sessionEmail(session);
  const p = profileFor(email);
  p.addresses = p.addresses.filter((a) => a.id !== id);
  return account(email);
}

export function reorderDraft(session: string, ref: string): ReorderDraft {
  const email = sessionEmail(session);
  const order = orders.get(ref.trim().toUpperCase());
  if (!order || !placedBy(order, email)) throw new OrderError('not_found', 'We couldn’t find that order in your account.');
  if (!canReorder(order)) throw new OrderError('invalid_state', 'Only printed orders with an approved design can be reordered.');
  const proof = order.proofs.filter((p) => p.status === 'approved').at(-1)!;
  return {
    from: order.ref,
    product: order.product.slug,
    quantity: order.quantity,
    brief: structuredClone(order.brief),
    urgency: 'standard',
    handover: structuredClone(order.handover),
    common: {
      ...structuredClone(order.common),
      artwork: 'print-ready',
      notes: `Reorder of ${order.ref}: print the approved proof v${proof.version} again.${order.common.notes ? ` ${order.common.notes}` : ''}`.slice(0, 1000),
    },
  };
}

export function getStatement(session: string): Statement {
  const email = sessionEmail(session);
  return buildStatement([...orders.values()].filter((o) => placedBy(o, email)).map((o) => getOrderForStatement(o.ref)));
}

export function createCompany(session: string, details: { name: string; kraPin: string }): Account {
  const email = sessionEmail(session);
  if (companyOf(email)) throw new OrderError('invalid_state', 'Your email already belongs to a company.');
  const name = details.name.trim().slice(0, 120);
  const kraPin = details.kraPin.trim().toUpperCase().slice(0, 20);
  if (name.length < 2) throw new OrderError('invalid', 'Enter the company name.');
  if (kraPin && !/^[A-Z]\d{9}[A-Z]$/.test(kraPin)) throw new OrderError('invalid', 'A KRA PIN looks like P051234567X.');
  const id = `CO-${randomDigits(6)}`;
  companies.set(id, { id, name, kraPin, members: [{ email, name: profileFor(email).name || account(email).name || 'Owner', role: 'owner' }] });
  return account(email);
}

function ownCompany(email: string) {
  const c = companyOf(email);
  if (!c || c.role !== 'owner') throw new OrderError('invalid_state', 'Only the company’s owner can change its members.');
  return companies.get(c.id)!;
}

export function addCompanyMember(session: string, member: CompanyMember): Account {
  const email = sessionEmail(session);
  const company = ownCompany(email);
  const memberEmail = emailOf(member.email);
  if (companyOf(memberEmail)) throw new OrderError('invalid', 'That email already belongs to a company.');
  if (member.name.trim().length < 2) throw new OrderError('invalid', 'Enter their name.');
  if (company.members.length >= 50) throw new OrderError('invalid', 'Up to 50 people per company.');
  company.members.push({ email: memberEmail, name: member.name.trim().slice(0, 100), role: member.role === 'approver' ? 'approver' : 'member' });
  return account(email);
}

export function removeCompanyMember(session: string, memberEmail: string): Account {
  const email = sessionEmail(session);
  const company = ownCompany(email);
  const removed = normaliseEmail(memberEmail);
  if (removed === email) throw new OrderError('invalid', 'The owner can’t be removed.');
  company.members = company.members.filter((m) => m.email !== removed);
  return account(email);
}

export function signOut(session: string): void {
  sessions.delete(session);
}
