import { nairobiToday, normaliseKenyanPhone } from '../quote';
import { routeC2B, type C2BConfirmation, type C2BRoute } from '../payments/c2b';
import { estimatePrice, tierAvailability, UNPAID_EXPIRY_HOURS } from '../pricing';
import { invoiceIssuer } from '../site';
import { orderProducts } from './data/order-catalogue';
import {
  OrderError,
  type Order,
  type OrderAccess,
  type OrderInput,
  type OrderPayment,
  type OrderProduct,
  type OrderProgress,
  type OrderStatus,
  type PaymentStatus,
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

type Stored = Order & { token: string };
type Simulation = { ref: string; paymentId: string; resolveAt: number; outcome: 'paid' | 'failed' | 'cancelled' | 'timeout' };

export const orders = new Map<string, Stored>();
const simulations = new Map<string, Simulation>();
const usedReceipts = new Set<string>();
/** Invoices and receipts start afresh on the new system (owner, 6 Oct 2026): INV00001, RCT00001. */
let invoiceSeq = 0;
let receiptSeq = 0;
const nextReceiptNo = () => `RCT${String(++receiptSeq).padStart(5, '0')}`;

/** Paybill payments that couldn't be matched to an order, for staff to assign by hand. */
export const unmatchedPayments: (C2BConfirmation & { reason: string; receivedAt: string })[] = [];

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

function initialProgress(p: OrderProduct, quantity: number): OrderProgress {
  if (p.mechanism === 'A') return { kind: 'pieces', done: 0, total: quantity };
  if (p.mechanism === 'B') return { kind: 'stages', done: 0, total: p.stages.length, stages: p.stages.map((name) => ({ name, done: false })) };
  return { kind: 'rounds', done: 0, total: p.revisionRounds };
}

function find(ref: string, access: OrderAccess): Stored {
  const order = orders.get(ref.trim().toUpperCase());
  if (!order) throw new OrderError('not_found', 'We couldn’t find that order.');
  const ok =
    'token' in access
      ? access.token.length === order.token.length && access.token === order.token
      : normaliseKenyanPhone(access.phone) === order.customer.phone;
  if (!ok) throw new OrderError('not_found', 'We couldn’t find that order.');
  return order;
}

/** What the outside world sees: everything but the secret token. */
function publicCopy(order: Stored): Order {
  const copy: Partial<Stored> = structuredClone(order);
  delete copy.token;
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
    if (order.mechanism === 'B') setStatus(order, 'in_design', 'Survey fee paid. We’ll confirm your survey date.');
    else if (order.mechanism === 'A' && !order.needsDesign) setStatus(order, 'in_design', `${purpose === 'full' ? 'Paid in full' : 'Deposit paid'}. We’re checking your artwork.`);
    else setStatus(order, 'in_design', `${purpose === 'full' ? 'Paid in full' : 'Deposit paid'}. A designer is on your brief.`);
    notify(order, `Payment received for ${order.ref}, receipt ${order.payments.filter((p) => p.status === 'confirmed').at(-1)?.receiptNo ?? ''}. We’ve started on your order.`);
  } else if (order.status === 'awaiting_balance') {
    setStatus(order, 'in_production', 'Balance paid. Your order is in production.');
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
  if (!tierAvailability(p, input.urgency, input.quantity).available) throw new OrderError('invalid', 'That deadline isn’t available for this order.');
  if (!input.customer.phone || !input.customer.name) throw new OrderError('invalid', 'Your name and phone are needed.');

  // The price is always worked out here; anything the browser showed is ignored.
  const estimate = estimatePrice(p, input, today());
  const ref = newRef();
  const now = iso();
  const order: Stored = {
    ref,
    token: crypto.randomUUID().replace(/-/g, ''),
    invoiceNo: `INV${String(++invoiceSeq).padStart(5, '0')}`,
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
  };
  orders.set(ref, order);
  notify(order, `Thank you, ${order.customer.name.split(' ')[0]}. Order ${ref} is placed: pay KES ${order.dueNow.toLocaleString('en-KE')} to start.`);
  return { ref, token: order.token };
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

export function approveProof(ref: string, access: OrderAccess, version: number): Order {
  const order = find(ref, access);
  settle(order);
  const proof = order.proofs.at(-1);
  if (order.status !== 'awaiting_approval' || !proof || proof.version !== version || proof.status !== 'pending') {
    throw new OrderError('invalid_state', 'That proof can’t be approved now.');
  }
  proof.status = 'approved';
  event(order, `Proof v${version} approved.`);
  if (order.mechanism === 'C') {
    setStatus(order, 'out_for_handover', 'Your final files are ready to download.');
  } else if (order.total !== null && order.total - order.amountPaid > 0) {
    order.dueNow = order.total - order.amountPaid;
    order.duePurpose = 'balance';
    setStatus(order, 'awaiting_balance', `Pay the balance of KES ${order.dueNow.toLocaleString('en-KE')} and printing starts.`);
    notify(order, `Proof approved for ${order.ref}. Pay the balance of KES ${order.dueNow.toLocaleString('en-KE')} to start printing.`);
  } else {
    setStatus(order, 'in_production', 'Proof approved; your order is in production.');
  }
  return publicCopy(order);
}

export function requestChanges(ref: string, access: OrderAccess, version: number, comments: string): Order {
  const order = find(ref, access);
  settle(order);
  const proof = order.proofs.at(-1);
  const text = comments.trim().slice(0, 2000);
  if (order.status !== 'awaiting_approval' || !proof || proof.version !== version || proof.status !== 'pending') {
    throw new OrderError('invalid_state', 'That proof can’t be changed now.');
  }
  if (text.length < 5) throw new OrderError('invalid', 'Tell the designer what to change.');
  proof.status = 'changes_requested';
  proof.comments = text;
  if (order.progress.kind === 'rounds') order.progress.done = Math.min(order.progress.total + 5, order.progress.done + 1);
  setStatus(order, 'in_design', `Changes requested on proof v${version}.`);
  return publicCopy(order);
}

export function bookSurvey(ref: string, access: OrderAccess, date: string): Order {
  const order = find(ref, access);
  settle(order);
  if (order.mechanism !== 'B' || !order.survey) throw new OrderError('invalid_state', 'Only site jobs have a survey.');
  if (order.status !== 'in_design') throw new OrderError('invalid_state', 'Pay the survey fee first.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today()) throw new OrderError('invalid', 'Choose a date from tomorrow on.');
  order.survey.booked = date;
  event(order, `Survey booked for ${date}.`);
  notify(order, `Your site survey for ${order.ref} is booked for ${date}.`);
  return publicCopy(order);
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
    order.proofs.push({ version, status: 'pending', uploadedAt: iso(), note: version === 1 ? 'First proof.' : 'Revised as you asked.', comments: null });
    setStatus(order, 'awaiting_approval', `Proof v${version} is ready for you to check.`);
    notify(order, `Proof v${version} for ${order.ref} is ready. Approve it or ask for changes.`);
  },
  /** Logs production: pieces for A, the next stage for B. */
  logProgress(ref: string, pieces = 50): void {
    const order = orders.get(ref);
    if (!order) throw new OrderError('not_found', 'No such order.');
    settle(order);
    if (order.status !== 'in_production') throw new OrderError('invalid_state', 'The order isn’t in production.');
    const p = order.progress;
    if (p.kind === 'pieces') {
      p.done = Math.min(p.total, p.done + pieces);
      event(order, `${p.done} of ${p.total} done.`);
      if (p.done >= p.total) setStatus(order, 'ready', 'Checked and packed.');
    } else if (p.kind === 'stages') {
      const next = p.stages.find((s) => !s.done);
      if (next) {
        next.done = true;
        p.done++;
        event(order, `${next.name}: done.`);
      }
      if (p.done >= p.total) setStatus(order, 'completed', 'Installed and signed off.');
    }
  },
  /** Ready → out for handover → completed. */
  handOver(ref: string): void {
    const order = orders.get(ref);
    if (!order) throw new OrderError('not_found', 'No such order.');
    if (order.status === 'ready') {
      setStatus(order, 'out_for_handover', order.handover.method === 'delivery' ? 'Out for delivery.' : 'Ready for pickup on Loita Street.');
      notify(order, `${order.ref} is ${order.handover.method === 'delivery' ? 'out for delivery' : 'ready for pickup'}.`);
    } else if (order.status === 'out_for_handover') {
      setStatus(order, 'completed', 'Handed over. Thank you!');
    } else throw new OrderError('invalid_state', 'Not ready to hand over yet.');
  },
  /** Moves the clock check: makes this order's pending simulations and expiry due now. */
  fastForward(ref: string, ms: number): void {
    const order = orders.get(ref);
    if (!order) return;
    for (const sim of simulations.values()) if (sim.ref === ref) sim.resolveAt -= ms;
    if (order.expiresAt) order.expiresAt = new Date(Date.parse(order.expiresAt) - ms).toISOString();
  },
};
