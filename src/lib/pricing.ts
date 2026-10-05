import type {
  BriefAnswers,
  BriefField,
  DeliveryZone,
  Handover,
  OrderProduct,
  PriceEstimate,
  PriceLine,
  PriceRequest,
  PriceTier,
  TierOption,
  UrgencyCode,
} from './api/order-types';
import { addWorkingDays } from './calendar';
import { formatKes } from './format';

/**
 * The order price (docs/ORDER_WORKFLOW_SPEC.md, "Pricing"). Pure: the order form uses it for the
 * instant price, and the server runs it again when the order is placed; only the server's counts.
 *
 *   Total = (unit_price[tier] × qty + setup + design + options) × urgency + handover fee
 *
 * TODO(business): every number here is a proposal from the spec for Noorcom to confirm.
 */

export const URGENCY_TIERS: { code: UrgencyCode; label: string; multiplier: number; note: string }[] = [
  { code: 'economy', label: 'Economy', multiplier: 0.95, note: 'A flexible deadline, 5% off' },
  { code: 'standard', label: 'Standard', multiplier: 1, note: 'Our usual time' },
  { code: 'express', label: 'Express', multiplier: 1.25, note: 'About half the time, +25%' },
  { code: 'rush', label: 'Rush', multiplier: 1.5, note: 'Next working day, +50%. We confirm within an hour' },
];

export const DELIVERY_ZONES: { zone: DeliveryZone; label: string; fee: number; note: string }[] = [
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

export function unitPriceFor(tiers: PriceTier[], quantity: number): number {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  let price = sorted[0]?.unitPrice ?? 0;
  for (const tier of sorted) if (quantity >= tier.minQty) price = tier.unitPrice;
  return price;
}

/** Working days from proof approval to finished, for a deadline tier. */
export function leadDaysFor(urgency: UrgencyCode, standard: number): number {
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

/** Whether a deadline tier can be offered for this product and quantity, and why not. */
export function tierAvailability(product: OrderProduct, urgency: UrgencyCode, quantity: number): { available: boolean; reason?: string } {
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

/** Per-piece and one-off costs from the brief's priced choices, as price lines. */
export function briefCosts(fields: BriefField[], answers: BriefAnswers, quantity: number): PriceLine[] {
  const lines: PriceLine[] = [];
  const add = (label: string, unitDelta = 0, fixedDelta = 0) => {
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

export function handoverFee(handover: Handover): number {
  if (handover.method !== 'delivery') return 0;
  return DELIVERY_ZONES.find((z) => z.zone === handover.zone)?.fee ?? 0;
}

/** What is paid at checkout for a total, by mechanism. */
export function dueAtOrder(product: OrderProduct, total: number | null): PriceEstimate['dueNow'] {
  if (product.mechanism === 'B') return { amount: product.surveyFee, label: 'Survey fee, credited to your final bill', purpose: 'survey_fee' };
  const sum = total ?? 0;
  if (product.mechanism === 'C' || sum < FULL_PAYMENT_BELOW) return { amount: sum, label: 'Full payment', purpose: 'full' };
  return { amount: Math.round(sum * DEPOSIT_RATE), label: `${Math.round(DEPOSIT_RATE * 100)}% deposit`, purpose: 'deposit' };
}

type Core = Omit<PriceEstimate, 'tiers'>;

function estimateCore(product: OrderProduct, request: PriceRequest, today: string): Core {
  const urgencyTier = URGENCY_TIERS.find((t) => t.code === request.urgency) ?? URGENCY_TIERS[1]!;
  const notes: string[] = [];

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
  const lines: PriceLine[] = [];
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

/** The full estimate, with every deadline tier priced so the customer can compare. */
export function estimatePrice(product: OrderProduct, request: PriceRequest, today: string): PriceEstimate {
  const quantity = product.mechanism === 'A' ? request.quantity : 1;
  const tiers: TierOption[] = URGENCY_TIERS.map((t) => {
    const { available, reason } = tierAvailability(product, t.code, quantity);
    const core = available ? estimateCore(product, { ...request, urgency: t.code }, today) : null;
    return { code: t.code, label: t.label, multiplier: t.multiplier, available, reason, readyBy: core?.readyBy ?? null, total: core?.total ?? null };
  });
  const chosen = tierAvailability(product, request.urgency, quantity).available ? request.urgency : 'standard';
  return { ...estimateCore(product, { ...request, urgency: chosen }, today), tiers };
}
