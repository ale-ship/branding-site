import { addWorkingDays } from '../calendar';
import { allocate, book, machineFor, MACHINES, type CapacityCalendar, type Machine } from '../capacity';
import { nairobiToday, normaliseKenyanPhone } from '../quote';
import { routeC2B, type C2BConfirmation, type C2BRoute } from '../payments/c2b';
import { estimatePrice, UNPAID_EXPIRY_HOURS } from '../pricing';
import { isPickupCode, needsSample, partialDeliveryError } from '../production';
import { changeRequestError, checklistComplete, MAX_CHANGE_NOTES } from '../proof';
import { buildSiteQuote, installDateError } from '../site-quote';
import { invoiceIssuer } from '../site';
import { orderProducts } from './data/order-catalogue';
import { approversOf, canApprove, companies } from './mock-companies';
import { mockupImage, proofImage, samplePhoto } from './mock-art';
import { shared } from './mock-store';
import {
  OrderError,
  type ApprovalChecklist,
  type Delivery,
  type Order,
  type OrderAccess,
  type OrderInput,
  type OrderPayment,
  type OrderProduct,
  type OrderProgress,
  type OrderStatus,
  type PaymentStatus,
  type PriceLine,
  type ProofPin,
  type SiteQuoteItem,
} from './order-types';

/**
 * The mock order system: what our backend will do, in memory (docs/ORDER_WORKFLOW_SPEC.md,
 * "Rules the backend must enforce"). Nothing here talks to M-Pesa.
 *
 * - STK Push is simulated. The phone's last digit picks the outcome, as on Noorcom Computers:
 *   0 cancelled, 1 no answer (timeout after 60 s), 2 failed, anything else paid after about 6 s.
 * - Callbacks are applied lazily, when the order is next read, so it works without background
 *   timers (serverless hosting runs nothing between requests).
 * - An order only moves on a confirmed callback. A receipt number can credit only once.
 *   Underpayment keeps the order where it is; overpayment becomes credit. Unpaid orders expire.
 *
 * State lives in this server process only: it resets on restart, and on serverless hosting
 * separate instances don't share it.
 */

/** What the backend keeps beside the order: the secret link and the capacity it reserved. */
type Stored = Order & { token: string; reserved: { machine: Machine; days: Record<string, number> } | null };
type Simulation = { ref: string; paymentId: string; resolveAt: number; outcome: 'paid' | 'failed' | 'cancelled' | 'timeout' };

export const orders = shared('orders', () => new Map<string, Stored>());
const simulations = shared('simulations', () => new Map<string, Simulation>());
const usedReceipts = shared('usedReceipts', () => new Set<string>());
/** Invoices and receipts start afresh on the new system (owner, 6 Oct 2026): INV00001, RCT00001. */
const seq = shared('sequences', () => ({ invoice: 0, receipt: 0 }));
const nextReceiptNo = () => `RCT${String(++seq.receipt).padStart(5, '0')}`;

/** Capacity booked by orders (the workshop's other work is `seededLoad`). */
const bookings = shared<CapacityCalendar>('bookings', () => ({}));

/**
 * Mock only: the workshop's existing work, so the calendar isn't empty: the presses are busy for the
 * next four working days. The backend reads real bookings from its `capacity` table.
 */
const SEEDED: Partial<Record<Machine, number>> = { 'screen-press': 240, dtf: 120, embroidery: 60, 'wide-format': 15 };

/** The calendar the site prices against: seeded work plus every order's reservation, 60 days ahead. */
export function capacityCalendar(): CapacityCalendar {
  const cal: CapacityCalendar = structuredClone(bookings);
  let day = today();
  for (let i = 0; i < 4; i++) {
    day = addWorkingDays(day, 1);
    for (const [m, n] of Object.entries(SEEDED) as [Machine, number][]) book(cal, m, { [day]: n });
  }
  return cal;
}

/** Paybill payments that couldn't be matched to an order, for staff to assign by hand. */
export const unmatchedPayments = shared('unmatchedPayments', (): (C2BConfirmation & { reason: string; receivedAt: string })[] => []);

/** The clock, replaceable in tests. */
export const clock = { now: () => Date.now() };

const STK_ANSWER_MS = 6_000;
const STK_TIMEOUT_MS = 60_000;

const iso = () => new Date(clock.now()).toISOString();
const today = () => nairobiToday(new Date(clock.now()));
const randomDigits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

function newReceipt(): string {
  // M-Pesa receipts look like SJ5ABC1DEF: ten capitals and digits.
  let r: string;
  do {
    r = Array.from({ length: 10 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');
  } while (usedReceipts.has(r));
  return r;
}

function product(slug: string): OrderProduct {
  const p = orderProducts.find((x) => x.slug === slug);
  if (!p) throw new OrderError('invalid', 'That item can’t be ordered online.');
  return p;
}

function notify(order: Stored, text: string) {
  const at = iso();
  order.notifications.push({ at, channel: 'whatsapp', to: order.customer.phone, text });
  order.notifications.push({ at, channel: 'email', to: order.customer.email, text });
}

function event(order: Stored, text: string) {
  order.events.push({ at: iso(), text });
}

function setStatus(order: Stored, status: OrderStatus, text: string) {
  order.status = status;
  event(order, text);
}

/** The run starts: the promised date counts from today (spec, "Deadline starts at approval"). */
function startProduction(order: Stored, text: string) {
  order.production.startedOn = today();
  order.production.promisedBy = addWorkingDays(today(), order.estimate.leadDays);
  setStatus(order, 'in_production', text);
}

/** Site jobs: ticks a named stage (once), wherever the flow reaches it. */
function markStage(order: Stored, name: string) {
  const p = order.progress;
  if (p.kind !== 'stages') return;
  const stage = p.stages.find((x) => x.name === name);
  if (!stage || stage.done) return;
  stage.done = true;
  p.done++;
}

function initialProgress(p: OrderProduct, quantity: number): OrderProgress {
  if (p.mechanism === 'A') return { kind: 'pieces', done: 0, total: quantity };
  if (p.mechanism === 'B') return { kind: 'stages', done: 0, total: p.stages.length, stages: p.stages.map((name) => ({ name, done: false })) };
  return { kind: 'rounds', done: 0, total: p.revisionRounds };
}

function find(ref: string, access: OrderAccess): Stored {
  const order = orders.get(ref.trim().toUpperCase());
  if (!order) throw new OrderError('not_found', 'We couldn’t find that order.');
  const phone = 'phone' in access ? normaliseKenyanPhone(access.phone) : null;
  const ok =
    'token' in access
      ? access.token.length === order.token.length && access.token === order.token
      : // The phone that ordered, or an approver of the company it was ordered for.
        phone === order.customer.phone || (!!phone && !!order.company && canApprove(order.company.id, phone));
  if (!ok) throw new OrderError('not_found', 'We couldn’t find that order.');
  return order;
}

/** What the outside world sees: everything but the secret token and the reservation. */
function publicCopy(order: Stored): Order {
  const copy: Partial<Stored> = structuredClone(order);
  delete copy.token;
  delete copy.reserved;
  return copy as Order;
}

// ── Payments ────────────────────────────────────────────────────────────────

/** After a payment step is fully paid, the order moves to its next status. */
function advanceAfterPayment(order: Stored) {
  const purpose = order.duePurpose;
  order.duePurpose = null;
  order.dueNow = 0;
  if (order.status === 'awaiting_payment') {
    order.expiresAt = null;
    if (order.mechanism === 'B' && purpose === 'deposit') setStatus(order, 'in_design', 'Deposit paid. A designer is on your job.');
    else if (order.mechanism === 'B') setStatus(order, 'in_design', 'Survey fee paid. Choose your survey date.');
    else if (order.mechanism === 'A' && !order.needsDesign) setStatus(order, 'in_design', `${purpose === 'full' ? 'Paid in full' : 'Deposit paid'}. We’re checking your artwork.`);
    else setStatus(order, 'in_design', `${purpose === 'full' ? 'Paid in full' : 'Deposit paid'}. A designer is on your brief.`);
    notify(order, `Payment received for ${order.ref}, receipt ${order.payments.filter((p) => p.status === 'confirmed').at(-1)?.receiptNo ?? ''}. We’ve started on your order.`);
  } else if (order.status === 'awaiting_balance' && order.mechanism === 'B') {
    setStatus(order, 'completed', 'Balance paid. Thank you!');
    notify(order, `Balance received for ${order.ref}, receipt ${order.payments.filter((p) => p.status === 'confirmed').at(-1)?.receiptNo ?? ''}. Thank you for working with us.`);
  } else if (order.status === 'awaiting_balance') {
    startProduction(order, 'Balance paid. Your order is in production.');
    notify(order, `Balance received for ${order.ref}, receipt ${order.payments.filter((p) => p.status === 'confirmed').at(-1)?.receiptNo ?? ''}. Printing has started.`);
  }
}

/**
 * Applies a confirmed M-Pesa callback (STK or Paybill). Idempotent on the receipt number: a
 * repeated callback is ignored. Returns whether it credited anything.
 */
function applyCallback(order: Stored, cb: { receipt: string; amount: number; method: 'stk' | 'paybill'; phone: string | null; paymentId?: string }): boolean {
  if (usedReceipts.has(cb.receipt)) return false;
  usedReceipts.add(cb.receipt);

  let payment = cb.paymentId ? order.payments.find((p) => p.id === cb.paymentId) : undefined;
  if (payment) {
    payment.status = 'confirmed';
    payment.mpesaReceipt = cb.receipt;
    payment.receiptNo = nextReceiptNo();
    payment.settledAt = iso();
    payment.amount = cb.amount;
  } else {
    payment = {
      id: `PAY-${randomDigits(8)}`,
      purpose: order.duePurpose ?? 'balance',
      method: cb.method,
      phone: cb.phone,
      amount: cb.amount,
      status: 'confirmed',
      mpesaReceipt: cb.receipt,
      receiptNo: nextReceiptNo(),
      requestedAt: iso(),
      settledAt: iso(),
      message: null,
    };
    order.payments.push(payment);
  }

  order.amountPaid += cb.amount;
  const due = order.dueNow;
  if (due > 0 && cb.amount < due) {
    order.dueNow = due - cb.amount;
    event(order, `Part payment of KES ${cb.amount.toLocaleString('en-KE')} received; KES ${order.dueNow.toLocaleString('en-KE')} still due.`);
    return true;
  }
  // Overpayment. With a known total, paying more than the step needs simply reduces the balance;
  // only money beyond the whole total becomes credit. Without one (site jobs), the excess is credit.
  const excess = due > 0 ? cb.amount - due : cb.amount;
  if (order.total !== null) {
    const credit = Math.max(0, order.amountPaid - order.total);
    if (credit > order.credit) {
      order.credit = credit;
      event(order, `Paid KES ${credit.toLocaleString('en-KE')} more than the total; kept as credit.`);
    }
  } else if (excess > 0) {
    order.credit += excess;
    event(order, `KES ${excess.toLocaleString('en-KE')} more than due; kept as credit.`);
  }
  if (due > 0) advanceAfterPayment(order);
  return true;
}

function failPayment(payment: OrderPayment, status: PaymentStatus, message: string) {
  payment.status = status;
  payment.settledAt = iso();
  payment.message = message;
}

/** Applies anything that has happened since the order was last read. */
function settle(order: Stored) {
  for (const sim of [...simulations.values()].filter((s) => s.ref === order.ref)) {
    if (clock.now() < sim.resolveAt) continue;
    simulations.delete(sim.paymentId);
    const payment = order.payments.find((p) => p.id === sim.paymentId);
    if (!payment || payment.status !== 'pending') continue;
    if (sim.outcome === 'paid') applyCallback(order, { receipt: newReceipt(), amount: payment.amount, method: 'stk', phone: payment.phone, paymentId: payment.id });
    else if (sim.outcome === 'cancelled') failPayment(payment, 'cancelled', 'The request was cancelled on the phone.');
    else if (sim.outcome === 'failed') failPayment(payment, 'failed', 'M-Pesa declined the payment (for example, not enough balance).');
    else failPayment(payment, 'timeout', 'No answer on the phone within a minute.');
  }
  if (order.status === 'awaiting_payment' && order.expiresAt && clock.now() > Date.parse(order.expiresAt)) {
    setStatus(order, 'expired', `Not paid within ${UNPAID_EXPIRY_HOURS} hours, so the order has expired.`);
    if (order.reserved) book(bookings, order.reserved.machine, order.reserved.days, -1);
    order.reserved = null;
    order.dueNow = 0;
    order.duePurpose = null;
  }
}

// ── The SiteApi methods ─────────────────────────────────────────────────────

export function createOrder(input: OrderInput, newRef: () => string): { ref: string; token: string } {
  const p = product(input.product);
  if (p.mechanism === 'A' && (!Number.isInteger(input.quantity) || input.quantity < p.minQuantity)) {
    throw new OrderError('invalid', `The minimum is ${p.minQuantity} pieces.`);
  }
  if (!input.customer.phone || !input.customer.name) throw new OrderError('invalid', 'Your name and phone are needed.');

  // The price and the dates are always worked out here, against the capacity calendar; anything the
  // browser showed is ignored.
  const calendar = capacityCalendar();
  const estimate = estimatePrice(p, input, today(), calendar);
  if (p.mechanism !== 'B' && estimate.urgency.code !== input.urgency) throw new OrderError('invalid', 'That deadline isn’t available for this order any more: choose another.');
  // The order holds its slot on the machine until it is paid or expires.
  const machine = machineFor(p, input.brief);
  const reserved = machine ? { machine, days: allocate(input.quantity, machine, addWorkingDays(today(), 1), calendar).days } : null;
  if (reserved) book(bookings, reserved.machine, reserved.days);
  // A company order only for a member of that company; the server action sets it from the session.
  let company: Order['company'] = null;
  if (input.company) {
    const c = companies.get(input.company.id);
    if (!c || !c.members.some((m) => m.phone === input.customer.phone)) throw new OrderError('invalid', 'You’re not a member of that company.');
    company = { id: c.id, name: c.name, poNumber: input.company.poNumber.trim().slice(0, 40), approvers: approversOf(c).map((m) => m.name) };
  }
  const ref = newRef();
  const now = iso();
  const order: Stored = {
    ref,
    token: crypto.randomUUID().replace(/-/g, ''),
    reserved,
    invoiceNo: `INV${String(++seq.invoice).padStart(5, '0')}`,
    createdAt: now,
    expiresAt: new Date(clock.now() + UNPAID_EXPIRY_HOURS * 3_600_000).toISOString(),
    status: 'awaiting_payment',
    mechanism: p.mechanism,
    product: { slug: p.slug, name: p.name, category: p.category },
    quantity: p.mechanism === 'A' ? input.quantity : 1,
    brief: input.brief,
    common: input.common,
    needsDesign: p.mechanism === 'C' || input.needsDesign,
    urgency: estimate.urgency.code,
    handover: input.handover,
    customer: input.customer,
    estimate,
    total: estimate.total,
    amountPaid: 0,
    credit: 0,
    dueNow: estimate.dueNow.amount,
    duePurpose: estimate.dueNow.purpose,
    payments: [],
    events: [{ at: now, text: 'Order placed.' }],
    notifications: [],
    progress: initialProgress(p, input.quantity),
    proofs: [],
    survey: p.mechanism === 'B' ? { preferred: (input.brief.surveyDates as string[] | undefined) ?? [], booked: null } : null,
    siteQuote: null,
    installDate: null,
    sample: needsSample(p.mechanism, input.quantity) ? { status: 'waiting', photo: null, uploadedAt: null, comments: null } : null,
    production: { logs: [], dailyCapacity: machine ? MACHINES[machine].dailyUnits : null, startedOn: null, promisedBy: null },
    pickupCode: null,
    deliveries: [],
    handedOver: null,
    company,
  };
  orders.set(ref, order);
  notify(order, `Thank you, ${order.customer.name.split(' ')[0]}. Order ${ref} is placed: pay KES ${order.dueNow.toLocaleString('en-KE')} to start.`);
  return { ref, token: order.token };
}

/** For the accounts mock: an order already known to be the account's, settled and without secrets. */
export function getOrderForStatement(ref: string): Order {
  const order = orders.get(ref)!;
  settle(order);
  return publicCopy(order);
}

export function getOrder(ref: string, access: OrderAccess): Order | null {
  try {
    const order = find(ref, access);
    settle(order);
    return publicCopy(order);
  } catch (e) {
    if (e instanceof OrderError && e.code === 'not_found') return null;
    throw e;
  }
}

export function startPayment(ref: string, access: OrderAccess, phone: string): OrderPayment {
  const order = find(ref, access);
  settle(order);
  if (!['awaiting_payment', 'awaiting_balance'].includes(order.status) || order.dueNow <= 0) {
    throw new OrderError('invalid_state', 'Nothing is due on this order right now.');
  }
  const msisdn = normaliseKenyanPhone(phone);
  if (!msisdn) throw new OrderError('invalid', 'Enter the Safaricom number to pay from, like 0722 530 301.');
  // One prompt at a time: a second tap returns the one already on its way.
  const pending = order.payments.find((p) => p.status === 'pending');
  if (pending) return structuredClone(pending);

  const payment: OrderPayment = {
    id: `PAY-${randomDigits(8)}`,
    purpose: order.duePurpose ?? 'balance',
    method: 'stk',
    phone: msisdn,
    amount: order.dueNow,
    status: 'pending',
    mpesaReceipt: null,
    receiptNo: null,
    requestedAt: iso(),
    settledAt: null,
    message: null,
  };
  order.payments.push(payment);
  const last = msisdn.at(-1);
  const outcome: Simulation['outcome'] = last === '0' ? 'cancelled' : last === '1' ? 'timeout' : last === '2' ? 'failed' : 'paid';
  simulations.set(payment.id, { ref: order.ref, paymentId: payment.id, outcome, resolveAt: clock.now() + (outcome === 'timeout' ? STK_TIMEOUT_MS : STK_ANSWER_MS) });
  return structuredClone(payment);
}

export function approveProof(ref: string, access: OrderAccess, version: number, checklist: ApprovalChecklist): Order {
  const order = find(ref, access);
  settle(order);
  const proof = order.proofs.at(-1);
  if (order.status !== 'awaiting_approval' || !proof || proof.version !== version || proof.status !== 'pending') {
    throw new OrderError('invalid_state', 'That proof can’t be approved now.');
  }
  if (!checklistComplete(checklist)) throw new OrderError('invalid', 'Tick every item on the checklist to approve.');
  // Company orders are approved by the company's owner or an approver (spec, "company accounts").
  if (order.company) {
    const who = 'phone' in access ? normaliseKenyanPhone(access.phone) : order.customer.phone;
    if (!who || !canApprove(order.company.id, who)) {
      throw new OrderError('invalid_state', `Proofs for ${order.company.name} are approved by ${order.company.approvers.join(' or ') || 'the company’s approver'}. Ask them to sign in and approve.`);
    }
  }
  proof.status = 'approved';
  proof.decidedAt = iso();
  event(order, `Proof v${version} approved; the artwork is locked.`);
  if (order.mechanism === 'C') {
    setStatus(order, 'out_for_handover', 'Your final files are ready to download.');
  } else if (order.mechanism === 'B') {
    markStage(order, 'Design approved');
    startProduction(order, 'Design approved. Materials go to print; choose your installation date.');
    notify(order, `Design approved for ${order.ref}. Choose your installation date on your order page.`);
  } else if (order.total !== null && order.total - order.amountPaid > 0) {
    order.dueNow = order.total - order.amountPaid;
    order.duePurpose = 'balance';
    setStatus(order, 'awaiting_balance', `Pay the balance of KES ${order.dueNow.toLocaleString('en-KE')} and printing starts.`);
    notify(order, `Proof approved for ${order.ref}. Pay the balance of KES ${order.dueNow.toLocaleString('en-KE')} to start printing.`);
  } else {
    startProduction(order, 'Proof approved; your order is in production.');
  }
  return publicCopy(order);
}

export function requestChanges(ref: string, access: OrderAccess, version: number, comments: string, pins: ProofPin[]): Order {
  const order = find(ref, access);
  settle(order);
  const proof = order.proofs.at(-1);
  const text = comments.trim().slice(0, MAX_CHANGE_NOTES);
  if (order.status !== 'awaiting_approval' || !proof || proof.version !== version || proof.status !== 'pending') {
    throw new OrderError('invalid_state', 'That proof can’t be changed now.');
  }
  const problem = changeRequestError(text, pins);
  if (problem) throw new OrderError('invalid', problem);
  proof.status = 'changes_requested';
  proof.comments = text || null;
  proof.pins = pins;
  proof.decidedAt = iso();
  if (order.progress.kind === 'rounds') order.progress.done = Math.min(order.progress.total + 5, order.progress.done + 1);
  setStatus(order, 'in_design', `Changes requested on proof v${version}${pins.length ? ` (${pins.length} pinned note${pins.length === 1 ? '' : 's'})` : ''}.`);
  return publicCopy(order);
}

export function reviewSample(ref: string, access: OrderAccess, decision: 'approve' | 'changes', comments: string): Order {
  const order = find(ref, access);
  settle(order);
  if (order.status !== 'in_production' || order.sample?.status !== 'pending') throw new OrderError('invalid_state', 'There’s no sample waiting for you.');
  const text = comments.trim().slice(0, MAX_CHANGE_NOTES);
  if (decision === 'approve') {
    order.sample.status = 'approved';
    event(order, 'Sample approved; the full run is printing.');
  } else {
    if (text.length < 5) throw new OrderError('invalid', 'Tell us what to change on the sample.');
    order.sample.status = 'changes_requested';
    order.sample.comments = text;
    event(order, 'Changes asked for on the sample; we’ll print a new one.');
  }
  return publicCopy(order);
}

export function requestPartialDelivery(ref: string, access: OrderAccess, pieces: number): Order {
  const order = find(ref, access);
  settle(order);
  if (order.mechanism !== 'A' || order.status !== 'in_production' || order.handover.method !== 'delivery' || order.progress.kind !== 'pieces') {
    throw new OrderError('invalid_state', 'Early deliveries are for delivered orders in production.');
  }
  const problem = partialDeliveryError(pieces, order.progress.done, order.progress.total, order.deliveries);
  if (problem) throw new OrderError('invalid', problem);
  order.deliveries.push(newDelivery(order, pieces, true));
  event(order, `Early delivery of ${pieces.toLocaleString('en-KE')} pieces asked for.`);
  return publicCopy(order);
}

export function bookSurvey(ref: string, access: OrderAccess, date: string): Order {
  const order = find(ref, access);
  settle(order);
  if (order.mechanism !== 'B' || !order.survey) throw new OrderError('invalid_state', 'Only site jobs have a survey.');
  if (order.status !== 'in_design') throw new OrderError('invalid_state', 'Pay the survey fee first.');
  if (order.siteQuote) throw new OrderError('invalid_state', 'The survey is done.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today()) throw new OrderError('invalid', 'Choose a date from tomorrow on.');
  order.survey.booked = date;
  event(order, `Survey booked for ${date}.`);
  notify(order, `Your site survey for ${order.ref} is booked for ${date}.`);
  return publicCopy(order);
}

export function acceptSiteQuote(ref: string, access: OrderAccess): Order {
  const order = find(ref, access);
  settle(order);
  const q = order.siteQuote;
  if (order.mechanism !== 'B' || order.status !== 'in_design' || !q || q.status !== 'pending') throw new OrderError('invalid_state', 'There’s no quote waiting for you.');
  if (q.validUntil < today()) throw new OrderError('invalid_state', 'This quote has expired; WhatsApp us and we’ll refresh it.');
  q.status = 'accepted';
  q.acceptedAt = iso();
  order.total = q.total;
  markStage(order, 'Firm quote accepted');
  order.dueNow = q.deposit;
  order.duePurpose = 'deposit';
  setStatus(order, 'awaiting_payment', `Quote of KES ${q.total.toLocaleString('en-KE')} accepted. Pay the deposit of KES ${q.deposit.toLocaleString('en-KE')} to start the design.`);
  notify(order, `Thank you for accepting the quote for ${order.ref}. Pay the deposit of KES ${q.deposit.toLocaleString('en-KE')} to start.`);
  return publicCopy(order);
}

export function bookInstall(ref: string, access: OrderAccess, date: string): Order {
  const order = find(ref, access);
  settle(order);
  if (order.mechanism !== 'B' || order.status !== 'in_production') throw new OrderError('invalid_state', 'Installation is booked once the design is approved.');
  if (order.progress.kind === 'stages' && order.progress.stages.find((x) => x.name === 'Installed')?.done) throw new OrderError('invalid_state', 'The installation is done.');
  const problem = installDateError(date, today());
  if (problem) throw new OrderError('invalid', problem);
  const moved = order.installDate !== null;
  order.installDate = date;
  const p = order.progress;
  // The stage counts once everything before it is done; until then the date is simply kept.
  if (p.kind === 'stages') {
    const i = p.stages.findIndex((x) => x.name === 'Installation scheduled');
    if (i >= 0 && p.stages.slice(0, i).every((x) => x.done)) markStage(order, 'Installation scheduled');
  }
  event(order, `Installation ${moved ? 'moved to' : 'booked for'} ${date}.`);
  notify(order, `Installation for ${order.ref} is ${moved ? 'moved to' : 'booked for'} ${date}. Our team will call the day before.`);
  return publicCopy(order);
}

/**
 * Mock only: what the surveyor measures, from the brief. Staff enter the real measurements in the
 * quote builder on the back office.
 */
function surveyMeasurements(order: Stored): { items: SiteQuoteItem[]; extras: PriceLine[]; notes: string } {
  const b = order.brief;
  if (order.product.slug === 'vehicle-branding-job') {
    const count = typeof b.count === 'number' ? b.count : 1;
    const coverage = b.coverage === 'partial' ? 'partial' : b.coverage === 'decals' ? 'decals' : 'full';
    const item: SiteQuoteItem =
      coverage === 'full'
        ? { label: 'Full wrap', material: 'vehicle-wrap', widthCm: 900, heightCm: 180, quantity: count }
        : coverage === 'partial'
          ? { label: 'Partial wrap, both sides', material: 'vehicle-wrap', widthCm: 450, heightCm: 120, quantity: count }
          : { label: 'Door decals, pair', material: 'vinyl', widthCm: 60, heightCm: 60, quantity: count * 2 };
    return { items: [item], extras: [], notes: `${count} vehicle${count === 1 ? '' : 's'} checked; paintwork sound.` };
  }
  if (order.product.slug === 'outdoor-branding-job') {
    const size = b.size && typeof b.size === 'object' && 'widthCm' in b.size ? b.size : { widthCm: 400, heightCm: 120 };
    const material = b.signType === 'light-box' ? 'lightbox' : b.signType === 'billboard' ? 'flex-banner' : 'acp-sign';
    const extras: PriceLine[] = b.permit === true ? [] : [{ label: 'County permit', detail: 'paid to the county, at cost (estimate)', amount: 12000 }];
    return { items: [{ label: 'Sign face', material, widthCm: size.widthCm, heightCm: size.heightCm, quantity: 1 }], extras, notes: 'Fixing wall is masonry; ladder access from the street.' };
  }
  const surfaces = Array.isArray(b.surfaces) ? b.surfaces : ['walls'];
  const items: SiteQuoteItem[] = [];
  if (surfaces.includes('walls')) items.push({ label: 'Feature wall', material: 'wallpaper', widthCm: 420, heightCm: 260, quantity: 1 });
  if (surfaces.includes('glass')) items.push({ label: 'Glass partition manifestation', material: 'frosted', widthCm: 300, heightCm: 100, quantity: 1 });
  if (surfaces.includes('floor')) items.push({ label: 'Floor graphics', material: 'vinyl', widthCm: 100, heightCm: 100, quantity: 4 });
  if (surfaces.includes('signs')) items.push({ label: 'Reception sign', material: 'acp-sign', widthCm: 180, heightCm: 60, quantity: 1 });
  if (!items.length) items.push({ label: 'Feature wall', material: 'wallpaper', widthCm: 420, heightCm: 260, quantity: 1 });
  return { items, extras: [], notes: 'Walls are smooth plaster, ready for wallpaper.' };
}

// ── Handover ────────────────────────────────────────────────────────────────

const RIDERS = [
  { name: 'Kevin Mwangi', phone: '+254711000201' },
  { name: 'Faith Achieng', phone: '+254711000202' },
];

function newDelivery(order: Stored, pieces: number, partial: boolean): Delivery {
  return {
    id: `DLV-${randomDigits(6)}`,
    pieces,
    partial,
    status: 'requested',
    rider: null,
    riderPhone: null,
    waybill: null,
    recipient: null,
    requestedAt: iso(),
    deliveredAt: null,
  };
}

/** Assigns a rider (or a courier waybill outside Nairobi) and sends the delivery out. */
function dispatch(order: Stored, d: Delivery) {
  if (order.handover.method === 'delivery' && order.handover.zone === 'countrywide') d.waybill = `WB${randomDigits(8)}`;
  else {
    const rider = RIDERS[order.deliveries.indexOf(d) % RIDERS.length] ?? RIDERS[0]!;
    d.rider = rider.name;
    d.riderPhone = rider.phone;
  }
  d.status = 'out';
  const what = `${d.pieces.toLocaleString('en-KE')} pieces`;
  event(order, d.waybill ? `${what} sent by courier, waybill ${d.waybill}.` : `${what} out with ${d.rider}.`);
  notify(order, d.waybill ? `${order.ref}: ${what} are with the courier, waybill ${d.waybill}.` : `${order.ref}: ${what} are on the way with ${d.rider}, ${d.riderPhone}.`);
}

function deliver(order: Stored, d: Delivery, recipient: string) {
  d.status = 'delivered';
  d.recipient = recipient;
  d.deliveredAt = iso();
  event(order, `${d.pieces.toLocaleString('en-KE')} pieces delivered, received by ${recipient}.`);
}

/** Staff at the counter enter the customer's code; the order completes only when it matches. */
function collect(order: Stored, code: string, collector: string): boolean {
  if (order.status !== 'out_for_handover' || order.handover.method !== 'pickup' || !order.pickupCode) return false;
  if (!isPickupCode(code) || code.trim() !== order.pickupCode) {
    event(order, 'A pickup was tried with the wrong code.');
    return false;
  }
  order.handedOver = { at: iso(), method: 'pickup', detail: `Collected by ${collector}, code checked.` };
  setStatus(order, 'completed', `Collected by ${collector}. Thank you!`);
  return true;
}

// ── Paybill (C2B) ───────────────────────────────────────────────────────────

const c2b = (p: Pick<C2BConfirmation, 'receipt' | 'amount' | 'msisdn' | 'billRef'>): C2BConfirmation => ({
  ...p,
  shortCode: invoiceIssuer.paybill,
  paidAt: iso(),
  payerName: '',
});

/**
 * What the backend's C2B confirmation endpoint does: route the payment to an order, then record it.
 * A receipt seen before is ignored; a payment to a closed order is kept as credit and flagged; one
 * that matches nothing waits in `unmatchedPayments` for staff.
 */
export function receiveC2B(c: C2BConfirmation): { route: C2BRoute; credited: boolean } {
  if (usedReceipts.has(c.receipt)) return { route: { kind: 'unmatched', reason: 'no-match' }, credited: false };
  for (const o of orders.values()) settle(o);
  const candidates = [...orders.values()].map((o) => ({ ref: o.ref, status: o.status, dueNow: o.dueNow, customerPhone: o.customer.phone }));
  const route = routeC2B(c, candidates, invoiceIssuer.paybill);
  if (route.kind === 'unmatched') {
    unmatchedPayments.push({ ...c, reason: route.reason, receivedAt: iso() });
    return { route, credited: false };
  }
  const order = orders.get(route.ref)!;
  if (order.status === 'expired' || order.status === 'cancelled') {
    usedReceipts.add(c.receipt);
    order.payments.push({
      id: `PAY-${randomDigits(8)}`,
      purpose: 'balance',
      method: 'paybill',
      phone: c.msisdn,
      amount: c.amount,
      status: 'confirmed',
      mpesaReceipt: c.receipt,
      receiptNo: nextReceiptNo(),
      requestedAt: iso(),
      settledAt: iso(),
      message: 'Paid after the order closed: flagged for a refund or to reopen it.',
    });
    order.amountPaid += c.amount;
    order.credit += c.amount;
    event(order, `KES ${c.amount.toLocaleString('en-KE')} paid after the order closed; kept as credit and flagged for staff.`);
    return { route, credited: true };
  }
  const credited = applyCallback(order, { receipt: c.receipt, amount: c.amount, method: 'paybill', phone: c.msisdn });
  if (credited && route.by === 'phone-and-amount') event(order, 'Paybill payment matched by your phone number and the amount.');
  return { route, credited };
}

// ── Demo controls: what staff and M-Pesa would do (mock only) ───────────────

export const mockStaff = {
  /**
   * A Paybill payment typed the way the site tells customers to (`2055268420#NB123456`), sent through
   * the same C2B routing the backend will use. Returns whether it credited the order.
   */
  paybill(ref: string, amount: number, receipt = newReceipt()): boolean {
    const order = orders.get(ref);
    if (!order) throw new OrderError('not_found', 'No such order.');
    const { route, credited } = receiveC2B(c2b({ receipt, amount, msisdn: order.customer.phone, billRef: invoiceIssuer.paybillAccount(ref) }));
    return route.kind === 'matched' && credited;
  },
  /** A Paybill payment with only the bank account typed: routed by phone and exact amount, if it can be. */
  paybillWithoutReference(ref: string, amount: number): C2BRoute {
    const order = orders.get(ref);
    if (!order) throw new OrderError('not_found', 'No such order.');
    return receiveC2B(c2b({ receipt: newReceipt(), amount, msisdn: order.customer.phone, billRef: invoiceIssuer.accountNo })).route;
  },
  /** Sends the last confirmed payment's callback again, to show it can't credit twice. */
  repeatLastCallback(ref: string): boolean {
    const order = orders.get(ref);
    const last = order?.payments.filter((p) => p.status === 'confirmed').at(-1);
    if (!order || !last?.mpesaReceipt) return false;
    return applyCallback(order, { receipt: last.mpesaReceipt, amount: last.amount, method: last.method, phone: last.phone });
  },
  uploadProof(ref: string): void {
    const order = orders.get(ref);
    if (!order) throw new OrderError('not_found', 'No such order.');
    settle(order);
    if (order.status !== 'in_design') throw new OrderError('invalid_state', 'Proofs are uploaded while the order is in design.');
    const version = order.proofs.length + 1;
    order.proofs.push({
      version,
      status: 'pending',
      uploadedAt: iso(),
      note: version === 1 ? 'First proof.' : 'Revised as you asked.',
      comments: null,
      pins: [],
      image: proofImage(order, version),
      mockup: mockupImage(publicCopy(order), version),
      decidedAt: null,
    });
    setStatus(order, 'awaiting_approval', `Proof v${version} is ready for you to check.`);
    notify(order, `Proof v${version} for ${order.ref} is ready. Approve it or ask for changes.`);
  },
  /** Site jobs: the survey is done; the quote builder sends the firm quote. */
  completeSurvey(ref: string): void {
    const order = orders.get(ref);
    if (!order) throw new OrderError('not_found', 'No such order.');
    settle(order);
    if (order.mechanism !== 'B' || order.status !== 'in_design' || order.siteQuote) throw new OrderError('invalid_state', 'No survey is waiting.');
    if (!order.survey?.booked) throw new OrderError('invalid_state', 'The survey date isn’t booked yet.');
    const m = surveyMeasurements(order);
    const built = buildSiteQuote(m.items, m.extras, today());
    order.siteQuote = { issuedAt: iso(), validUntil: built.validUntil, status: 'pending', acceptedAt: null, surveyNotes: m.notes, items: m.items, lines: built.lines, total: built.total, deposit: built.deposit };
    markStage(order, 'Survey');
    event(order, `Survey done. Firm quote: KES ${built.total.toLocaleString('en-KE')}.`);
    notify(order, `Your firm quote for ${order.ref} is ready: KES ${built.total.toLocaleString('en-KE')}. Accept it on your order page.`);
  },
  /** Prints one piece and photographs it, for runs that need a sample before the full run. */
  uploadSample(ref: string): void {
    const order = orders.get(ref);
    if (!order) throw new OrderError('not_found', 'No such order.');
    settle(order);
    if (order.status !== 'in_production' || !order.sample || order.sample.status === 'approved' || order.sample.status === 'pending') {
      throw new OrderError('invalid_state', 'No sample is needed now.');
    }
    order.sample = { status: 'pending', photo: samplePhoto(publicCopy(order)), uploadedAt: iso(), comments: null };
    event(order, 'A sample is printed for you to check before the full run.');
    notify(order, `A sample of ${order.ref} is ready: check the photo and approve it to start the full run.`);
  },
  /** Logs production: pieces for A (blocked until the sample, if any, is approved), the next stage for B. */
  logProgress(ref: string, pieces = 50): void {
    const order = orders.get(ref);
    if (!order) throw new OrderError('not_found', 'No such order.');
    settle(order);
    if (order.status !== 'in_production') throw new OrderError('invalid_state', 'The order isn’t in production.');
    const p = order.progress;
    if (p.kind === 'pieces') {
      if (order.sample && order.sample.status !== 'approved') throw new OrderError('invalid_state', 'The sample needs the customer’s approval first.');
      const add = Math.min(p.total - p.done, pieces);
      p.done += add;
      order.production.logs.push({ at: iso(), pieces: add, note: `${add.toLocaleString('en-KE')} printed` });
      event(order, `${p.done.toLocaleString('en-KE')} of ${p.total.toLocaleString('en-KE')} done.`);
      if (p.done >= p.total) {
        setStatus(order, 'ready', 'Checked and packed.');
        notify(order, `${order.ref} is finished, checked and packed.`);
      }
    } else if (p.kind === 'stages') {
      const next = p.stages.find((s) => !s.done);
      if (!next) return;
      if (next.name === 'Installation scheduled' && !order.installDate) throw new OrderError('invalid_state', 'Waiting for the customer to choose an installation date.');
      markStage(order, next.name);
      if (next.name === 'Signed off') {
        order.handedOver = { at: iso(), method: 'install', detail: `Installed and signed off on site by ${order.customer.name}, with before and after photos.` };
        const balance = (order.total ?? 0) - order.amountPaid;
        if (balance > 0) {
          order.dueNow = balance;
          order.duePurpose = 'balance';
          setStatus(order, 'awaiting_balance', `Signed off. Pay the balance of KES ${balance.toLocaleString('en-KE')} (the survey fee is already taken off).`);
          notify(order, `Thank you for signing off ${order.ref}. The balance is KES ${balance.toLocaleString('en-KE')}.`);
        } else setStatus(order, 'completed', 'Installed and signed off.');
      } else {
        event(order, `${next.name}: done.`);
        // The date may have been chosen early: the scheduled stage follows as soon as it's reached.
        const after = p.stages.find((s) => !s.done);
        if (after?.name === 'Installation scheduled' && order.installDate) markStage(order, 'Installation scheduled');
      }
    }
  },
  /** Moves the open early delivery on: sent out, then delivered. */
  advanceEarlyDelivery(ref: string): void {
    const order = orders.get(ref);
    const d = order?.deliveries.find((x) => x.partial && x.status !== 'delivered');
    if (!order || !d) throw new OrderError('invalid_state', 'No early delivery is waiting.');
    if (d.status === 'requested') dispatch(order, d);
    else deliver(order, d, order.customer.name);
  },
  /**
   * Ready → out for handover (a pickup code, or a rider with the rest of the pieces) → completed (the
   * code checked at the counter, or delivered). Design-only orders complete when the files are downloaded.
   */
  handOver(ref: string): void {
    const order = orders.get(ref);
    if (!order) throw new OrderError('not_found', 'No such order.');
    settle(order);
    const h = order.handover;
    if (order.status === 'ready') {
      if (h.method === 'delivery') {
        const left = order.progress.kind === 'pieces' ? order.progress.total - order.deliveries.reduce((s, d) => s + d.pieces, 0) : order.quantity;
        const d = newDelivery(order, Math.max(0, left), false);
        order.deliveries.push(d);
        setStatus(order, 'out_for_handover', 'Out for delivery.');
        dispatch(order, d);
      } else {
        order.pickupCode = randomDigits(6);
        setStatus(order, 'out_for_handover', 'Ready for pickup on Loita Street.');
        notify(order, `${order.ref} is ready for pickup at Chuka Elimu Plaza, Loita Street. Your pickup code is ${order.pickupCode}.`);
      }
    } else if (order.status === 'out_for_handover') {
      if (h.method === 'pickup') collect(order, order.pickupCode ?? '', order.customer.name);
      else if (h.method === 'delivery') {
        for (const d of order.deliveries.filter((x) => x.status !== 'delivered')) {
          if (d.status === 'requested') dispatch(order, d);
          deliver(order, d, order.customer.name);
        }
        order.handedOver = { at: iso(), method: 'delivery', detail: `Delivered, received by ${order.customer.name}.` };
        setStatus(order, 'completed', 'Delivered. Thank you!');
      } else {
        order.handedOver = { at: iso(), method: h.method, detail: 'Final files downloaded.' };
        setStatus(order, 'completed', 'Files downloaded. Thank you!');
      }
    } else throw new OrderError('invalid_state', 'Not ready to hand over yet.');
  },
  /** Staff at the counter: checks a pickup code. */
  collect(ref: string, code: string, collector: string): boolean {
    const order = orders.get(ref);
    return order ? collect(order, code, collector) : false;
  },
  /** Moves the clock check: makes this order's pending simulations and expiry due now. */
  fastForward(ref: string, ms: number): void {
    const order = orders.get(ref);
    if (!order) return;
    for (const sim of simulations.values()) if (sim.ref === ref) sim.resolveAt -= ms;
    if (order.expiresAt) order.expiresAt = new Date(Date.parse(order.expiresAt) - ms).toISOString();
  },
};
