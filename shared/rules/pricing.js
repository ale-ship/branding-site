// @ts-check
import { addWorkingDays, formatDay } from './calendar.js';
import { capacityFinish } from './capacity.js';
import { formatKes } from './format.js';

/**
 * @typedef {import('../contract/order-types.js').BriefAnswers} BriefAnswers
 * @typedef {import('../contract/order-types.js').BriefField} BriefField
 * @typedef {import('../contract/order-types.js').DeliveryZone} DeliveryZone
 * @typedef {import('../contract/order-types.js').Handover} Handover
 * @typedef {import('../contract/order-types.js').OrderProduct} OrderProduct
 * @typedef {import('../contract/order-types.js').PriceEstimate} PriceEstimate
 * @typedef {import('../contract/order-types.js').PriceLine} PriceLine
 * @typedef {import('../contract/order-types.js').PriceRequest} PriceRequest
 * @typedef {import('../contract/order-types.js').PriceTier} PriceTier
 * @typedef {import('../contract/order-types.js').TierOption} TierOption
 * @typedef {import('../contract/order-types.js').UrgencyCode} UrgencyCode
 * @typedef {import('./capacity.js').CapacityCalendar} CapacityCalendar
 */

/**
 * The order price (docs/ORDER_WORKFLOW_SPEC.md, "Pricing"). Pure: the order form uses it for the
 * instant price, and the server runs it again when the order is placed; only the server's counts.
 *
 *   Total = (unit_price[tier] × qty + setup + design + options) × urgency + handover fee
 *
 * TODO(business): every number here is a proposal from the spec for Noorcom to confirm.
 */

/** @type {{ code: UrgencyCode; label: string; multiplier: number; note: string }[]} */
export const URGENCY_TIERS = [
  { code: 'economy', label: 'Economy', multiplier: 0.95, note: 'A flexible deadline, 5% off' },
  { code: 'standard', label: 'Standard', multiplier: 1, note: 'Our usual time' },
  { code: 'express', label: 'Express', multiplier: 1.25, note: 'About half the time, +25%' },
  { code: 'rush', label: 'Rush', multiplier: 1.5, note: 'Next working day, +50%. We confirm within an hour' },
];

/** @type {{ zone: DeliveryZone; label: string; fee: number; note: string }[]} */
export const DELIVERY_ZONES = [
  { zone: 'cbd', label: 'Nairobi CBD', fee: 300, note: 'Within the CBD' },
  { zone: 'inner', label: 'Nairobi, inner', fee: 500, note: 'Westlands, Kilimani, Upper Hill, South B and C, Ngara' },
  { zone: 'outer', label: 'Nairobi, outer', fee: 800, note: 'Karen, Runda, Kasarani, Embakasi, Rongai, Ruaka' },
  { zone: 'countrywide', label: 'Outside Nairobi', fee: 1200, note: 'By courier to your town' },
];

/** Orders under this are paid in full; above it, a deposit. */
export const FULL_PAYMENT_BELOW = 5000;
export const DEPOSIT_RATE = 0.5;
/** Unpaid orders expire after this. */
export const UNPAID_EXPIRY_HOURS = 48;

/**
 * @param {PriceTier[]} tiers
 * @param {number} quantity
 * @returns {number}
 */
export function unitPriceFor(tiers, quantity) {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  let price = sorted[0]?.unitPrice ?? 0;
  for (const tier of sorted) if (quantity >= tier.minQty) price = tier.unitPrice;
  return price;
}

/**
 * Working days from proof approval to finished, for a deadline tier.
 * @param {UrgencyCode} urgency
 * @param {number} standard
 * @returns {number}
 */
export function leadDaysFor(urgency, standard) {
  switch (urgency) {
    case 'economy':
      return Math.max(standard + 1, Math.ceil(standard * 1.5));
    case 'express':
      return Math.max(1, Math.ceil(standard / 2));
    case 'rush':
      return 1;
    default:
      return standard;
  }
}

/**
 * Whether a deadline tier can be offered for this product and quantity, and why not.
 * @param {OrderProduct} product
 * @param {UrgencyCode} urgency
 * @param {number} quantity
 * @returns {{ available: boolean; reason?: string }}
 */
export function tierAvailability(product, urgency, quantity) {
  if (product.mechanism === 'B') {
    return urgency === 'standard' ? { available: true } : { available: false, reason: 'Site jobs are scheduled after the survey' };
  }
  if (urgency === 'rush') {
    if (!product.rushAllowed) return { available: false, reason: 'Not available for this item' };
    if (product.rushMaxQty && quantity > product.rushMaxQty) {
      return { available: false, reason: `Up to ${product.rushMaxQty.toLocaleString('en-KE')} pieces` };
    }
  }
  if (urgency === 'express' && product.standardLeadDays <= 1) return { available: false, reason: 'Already our fastest' };
  return { available: true };
}

/**
 * Per-piece and one-off costs from the brief's priced choices, as price lines.
 * @param {BriefField[]} fields
 * @param {BriefAnswers} answers
 * @param {number} quantity
 * @returns {PriceLine[]}
 */
export function briefCosts(fields, answers, quantity) {
  /** @type {PriceLine[]} */
  const lines = [];
  /** @param {string} label @param {number} [unitDelta] @param {number} [fixedDelta] */
  const add = (label, unitDelta = 0, fixedDelta = 0) => {
    if (unitDelta) lines.push({ label, detail: `${formatKes(unitDelta)} × ${quantity.toLocaleString('en-KE')}`, amount: unitDelta * quantity, quantity, unitPrice: unitDelta });
    if (fixedDelta) lines.push({ label, detail: 'once per order', amount: fixedDelta });
  };
  for (const field of fields) {
    const value = answers[field.id];
    if (field.kind === 'select' && typeof value === 'string') {
      const option = field.options.find((o) => o.value === value);
      if (option) add(`${field.label}: ${option.label}`, option.unitDelta, option.fixedDelta);
    } else if (field.kind === 'multiselect' && Array.isArray(value)) {
      for (const option of field.options.filter((o) => value.includes(o.value))) {
        add(`${field.label}: ${option.label}`, option.unitDelta, option.fixedDelta);
      }
    } else if (field.kind === 'yesno' && value === true) {
      add(field.label, field.yesUnitDelta, field.yesFixedDelta);
    }
  }
  return lines;
}

/**
 * @param {Handover} handover
 * @returns {number}
 */
export function handoverFee(handover) {
  if (handover.method !== 'delivery') return 0;
  return DELIVERY_ZONES.find((z) => z.zone === handover.zone)?.fee ?? 0;
}

/**
 * What is paid at checkout for a total, by mechanism.
 * @param {OrderProduct} product
 * @param {number | null} total
 * @returns {PriceEstimate['dueNow']}
 */
export function dueAtOrder(product, total) {
  if (product.mechanism === 'B') return { amount: product.surveyFee, label: 'Survey fee, credited to your final bill', purpose: 'survey_fee' };
  const sum = total ?? 0;
  if (product.mechanism === 'C' || sum < FULL_PAYMENT_BELOW) return { amount: sum, label: 'Full payment', purpose: 'full' };
  return { amount: Math.round(sum * DEPOSIT_RATE), label: `${Math.round(DEPOSIT_RATE * 100)}% deposit`, purpose: 'deposit' };
}

/** @typedef {Omit<PriceEstimate, 'tiers'>} Core */

/**
 * @param {OrderProduct} product
 * @param {PriceRequest} request
 * @param {string} today
 * @returns {Core}
 */
function estimateCore(product, request, today) {
  const urgencyTier = URGENCY_TIERS.find((t) => t.code === request.urgency) ?? URGENCY_TIERS[1];
  if (!urgencyTier) throw new Error('No urgency tiers');
  /** @type {string[]} */
  const notes = [];

  if (product.mechanism === 'B') {
    const dueNow = dueAtOrder(product, null);
    return {
      mechanism: 'B',
      lines: [{ label: 'Site survey', detail: 'measurements, surfaces, access and permits', amount: product.surveyFee }],
      subtotal: product.surveyFee,
      urgency: { code: 'standard', label: 'Standard', multiplier: 1, amount: 0 },
      handoverFee: 0,
      total: null,
      dueNow,
      balanceLater: null,
      leadDays: product.standardLeadDays,
      readyBy: null,
      notes: ['You get a firm price after the survey. The survey fee comes off your final bill.'],
    };
  }

  const quantity = product.mechanism === 'C' ? 1 : request.quantity;
  /** @type {PriceLine[]} */
  const lines = [];
  if (product.mechanism === 'A') {
    const unit = unitPriceFor(product.priceTiers, quantity);
    lines.push({ label: product.name, detail: `${formatKes(unit)} × ${quantity.toLocaleString('en-KE')}`, amount: unit * quantity, quantity, unitPrice: unit });
    if (product.setupFee) lines.push({ label: 'Setup', detail: 'screens, plates or set-up, once per order', amount: product.setupFee });
    if (request.needsDesign && product.designFee) lines.push({ label: 'Design', detail: 'our studio designs it, 2 revision rounds', amount: product.designFee });
    const next = [...product.priceTiers].sort((a, b) => a.minQty - b.minQty).find((t) => t.minQty > quantity);
    if (next) notes.push(`From ${next.minQty.toLocaleString('en-KE')} pieces the price drops to ${formatKes(next.unitPrice)} each.`);
  } else {
    lines.push({ label: product.name, detail: `${product.revisionRounds} revision rounds included`, amount: product.packagePrice });
  }
  lines.push(...briefCosts(product.brief, request.brief, quantity));

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const urgencyAmount = Math.round(subtotal * (urgencyTier.multiplier - 1));
  const fee = product.mechanism === 'C' ? 0 : handoverFee(request.handover);
  const total = subtotal + urgencyAmount + fee;
  const dueNow = dueAtOrder(product, total);
  const leadDays = leadDaysFor(urgencyTier.code, product.standardLeadDays);
  // The clock starts at proof approval; we assume the proof is approved the next working day.
  const readyBy = addWorkingDays(addWorkingDays(today, 1), leadDays);
  notes.push('Dates count from when you approve the proof and pay the balance.');
  if (urgencyTier.code === 'rush') notes.push('Rush depends on capacity: we confirm within an hour of your order.');

  return {
    mechanism: product.mechanism,
    lines,
    subtotal,
    urgency: { code: urgencyTier.code, label: urgencyTier.label, multiplier: urgencyTier.multiplier, amount: urgencyAmount },
    handoverFee: fee,
    total,
    dueNow,
    balanceLater: total - dueNow.amount,
    leadDays,
    readyBy,
    notes,
  };
}

/**
 * The full estimate, with every deadline tier priced so the customer can compare. With the capacity
 * calendar, a tier the workshop can't meet is switched off (express, rush) or moved to the earliest
 * day it can (economy, standard).
 * @param {OrderProduct} product
 * @param {PriceRequest} request
 * @param {string} today
 * @param {CapacityCalendar} [calendar]
 * @returns {PriceEstimate}
 */
export function estimatePrice(product, request, today, calendar) {
  const quantity = product.mechanism === 'A' ? request.quantity : 1;
  const finish = calendar ? capacityFinish(product, quantity, request.brief, today, calendar) : null;
  /** @param {string | null} date */
  const later = (date) => (date && finish && finish > date ? finish : date);
  /** @type {TierOption[]} */
  const tiers = URGENCY_TIERS.map((t) => {
    let { available, reason } = tierAvailability(product, t.code, quantity);
    const core = available ? estimateCore(product, { ...request, urgency: t.code }, today) : null;
    if (core?.readyBy && finish && finish > core.readyBy && (t.code === 'express' || t.code === 'rush')) {
      available = false;
      reason = `Fully booked: the earliest we can finish is ${formatDay(finish)}`;
    }
    return { code: t.code, label: t.label, multiplier: t.multiplier, available, reason, readyBy: available ? later(core?.readyBy ?? null) : null, total: available ? (core?.total ?? null) : null };
  });
  const chosen = tiers.find((t) => t.code === request.urgency)?.available ? request.urgency : 'standard';
  const core = estimateCore(product, { ...request, urgency: chosen }, today);
  if (core.readyBy && finish && finish > core.readyBy) {
    core.readyBy = finish;
    core.notes.push(`The workshop is busy: the earliest we can finish is ${formatDay(finish)}.`);
  }
  return { ...core, tiers };
}
