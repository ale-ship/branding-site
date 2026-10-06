/**
 * Online ordering (docs/ORDER_WORKFLOW_SPEC.md). Part of the data contract: pages reach all of this
 * only through `api` from `@/lib/api`. The mock implements it today; our backend will later.
 */
import type { ArtworkFile, Photo, ServiceSlug } from './types';

/** A: quantity run (pieces). B: site installation (stages). C: design only (revision rounds). */
export type Mechanism = 'A' | 'B' | 'C';

export type OrderCategorySlug =
  | 'apparel'
  | 'corporate-gifts'
  | 'stationery'
  | 'books'
  | 'print'
  | 'large-format'
  | 'indoor-branding'
  | 'outdoor-branding'
  | 'vehicle-branding'
  | 'design';

export type OrderCategory = {
  slug: OrderCategorySlug;
  name: string;
  mechanism: Mechanism;
  summary: string;
  image: Photo;
  /** The service page that describes this kind of work, if any. */
  service?: ServiceSlug;
};

/** A choice in a brief field. Deltas feed the price: per piece, or once per order. */
export type BriefOption = { value: string; label: string; unitDelta?: number; fixedDelta?: number };

type FieldBase = { id: string; label: string; required?: boolean; help?: string };

/**
 * One question in a product's brief. Products carry a list of these, so a new product needs data,
 * not code: `components/order/BriefFields.tsx` draws any of them.
 */
export type BriefField =
  | (FieldBase & { kind: 'select'; options: BriefOption[] })
  | (FieldBase & { kind: 'multiselect'; options: BriefOption[]; max?: number })
  | (FieldBase & { kind: 'number'; min?: number; max?: number; unit?: string })
  | (FieldBase & { kind: 'text' | 'textarea'; placeholder?: string; maxLength?: number })
  /** A quantity per size that must add up to the order quantity (apparel). */
  | (FieldBase & { kind: 'sizes'; sizes: string[] })
  /** Width × height in centimetres. */
  | (FieldBase & { kind: 'dimensions'; maxCm?: number })
  /** Preferred dates, e.g. for a site survey. */
  | (FieldBase & { kind: 'dates'; count: number })
  | (FieldBase & { kind: 'yesno'; yesUnitDelta?: number; yesFixedDelta?: number });

export type Dimensions = { widthCm: number; heightCm: number };
export type BriefValue = string | string[] | number | boolean | Record<string, number> | Dimensions;
/** Answers to a product's brief, keyed by field id. */
export type BriefAnswers = Record<string, BriefValue>;

/** Unit price from `minQty` pieces up (the tiers are sorted by minQty). */
export type PriceTier = { minQty: number; unitPrice: number };

type OrderProductBase = {
  slug: string;
  name: string;
  category: OrderCategorySlug;
  summary: string;
  image: Photo;
  /** Working days from proof approval to finished, at standard speed. */
  standardLeadDays: number;
  /** Whether the Rush tier may be offered, and up to how many pieces. */
  rushAllowed: boolean;
  rushMaxQty?: number;
  brief: BriefField[];
};

export type OrderProduct =
  | (OrderProductBase & {
      mechanism: 'A';
      /** The shop item this prices, so both always agree (checked in tests). */
      shopSlug?: string;
      priceTiers: PriceTier[];
      minQuantity: number;
      /** One-off cost per order, e.g. screens or plates. */
      setupFee: number;
      /** Charged when the customer needs the artwork designed. */
      designFee: number;
    })
  | (OrderProductBase & {
      mechanism: 'B';
      /** Paid online to book the survey; credited to the final bill. */
      surveyFee: number;
      /** The stages the tracker counts. */
      stages: string[];
    })
  | (OrderProductBase & {
      mechanism: 'C';
      packagePrice: number;
      revisionRounds: number;
    });

/** The brief questions every order shares (spec, "Common brief block"). */
export type CommonBrief = {
  /** HEX or Pantone, up to 5. */
  colours: string[];
  typography: 'from-logo' | 'designer' | 'named';
  fonts: string;
  /** Logo and assets. Only names and sizes travel until the backend takes uploads. */
  assets: ArtworkFile[];
  inspiration: ArtworkFile[];
  inspirationLinks: string[];
  /** The exact words to appear. */
  text: string;
  styles: string[];
  artwork: 'print-ready' | 'need-design';
  notes: string;
};

export type UrgencyCode = 'economy' | 'standard' | 'express' | 'rush';

export type DeliveryZone = 'cbd' | 'inner' | 'outer' | 'countrywide';

/** How the customer receives the work. Install is the only option for B, digital for C. */
export type Handover =
  | { method: 'pickup' }
  | { method: 'delivery'; zone: DeliveryZone; address: string }
  | { method: 'install'; address: string }
  | { method: 'digital' };

export type PriceRequest = {
  product: string;
  /** Pieces for A; 1 for B and C. */
  quantity: number;
  brief: BriefAnswers;
  needsDesign: boolean;
  urgency: UrgencyCode;
  handover: Handover;
};

/** A line of the price. `quantity` and `unitPrice` are set for per-piece lines (the invoice shows them). */
export type PriceLine = { label: string; detail?: string; amount: number; quantity?: number; unitPrice?: number };

export type PaymentPurpose = 'deposit' | 'full' | 'survey_fee' | 'balance';

export type TierOption = {
  code: UrgencyCode;
  label: string;
  multiplier: number;
  available: boolean;
  /** Why it isn't offered, when it isn't. */
  reason?: string;
  readyBy: string | null;
  total: number | null;
};

export type PriceEstimate = {
  mechanism: Mechanism;
  lines: PriceLine[];
  subtotal: number;
  urgency: { code: UrgencyCode; label: string; multiplier: number; amount: number };
  handoverFee: number;
  /** Null for site jobs: the firm price comes after the survey. */
  total: number | null;
  dueNow: { amount: number; label: string; purpose: PaymentPurpose };
  /** What's left to pay later, when known. */
  balanceLater: number | null;
  leadDays: number;
  /** YYYY-MM-DD, assuming the proof is approved the next working day. */
  readyBy: string | null;
  tiers: TierOption[];
  notes: string[];
};

export type OrderStatus =
  | 'awaiting_payment'
  | 'in_design'
  | 'awaiting_approval'
  | 'awaiting_balance'
  | 'in_production'
  | 'ready'
  | 'out_for_handover'
  | 'completed'
  | 'expired'
  | 'on_hold'
  | 'cancelled';

export type PaymentMethod = 'stk' | 'paybill';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'timeout';

export type OrderPayment = {
  id: string;
  purpose: PaymentPurpose;
  method: PaymentMethod;
  phone: string | null;
  amount: number;
  status: PaymentStatus;
  /** M-Pesa receipt, unique: a repeated callback can never credit twice. */
  mpesaReceipt: string | null;
  /** Noorcom's own receipt number (RCT00001…), given when the payment is confirmed. */
  receiptNo: string | null;
  requestedAt: string;
  settledAt: string | null;
  /** Why it failed, for the customer. */
  message: string | null;
};

export type OrderEvent = { at: string; text: string };

/** Noorcom sends on WhatsApp and email only, never SMS (spec, "Notifications"). */
export type OrderNotification = { at: string; channel: 'whatsapp' | 'email'; to: string; text: string };

export type Proof = {
  version: number;
  status: 'pending' | 'approved' | 'changes_requested';
  uploadedAt: string;
  note: string;
  comments: string | null;
};

export type OrderProgress =
  | { kind: 'pieces'; done: number; total: number }
  | { kind: 'stages'; done: number; total: number; stages: { name: string; done: boolean }[] }
  | { kind: 'rounds'; done: number; total: number };

export type Customer = { name: string; company: string; phone: string; email: string };

export type OrderInput = PriceRequest & { common: CommonBrief; customer: Customer };

export type Order = {
  /** NB- and six digits; also the M-Pesa account reference. */
  ref: string;
  invoiceNo: string;
  createdAt: string;
  /** Unpaid orders expire (48 h); null once paid. */
  expiresAt: string | null;
  status: OrderStatus;
  mechanism: Mechanism;
  product: { slug: string; name: string; category: OrderCategorySlug };
  quantity: number;
  brief: BriefAnswers;
  common: CommonBrief;
  needsDesign: boolean;
  urgency: UrgencyCode;
  handover: Handover;
  customer: Customer;
  /** The price as agreed when the order was placed. */
  estimate: PriceEstimate;
  /** Null until a site job's firm quote exists. */
  total: number | null;
  amountPaid: number;
  /** Paid beyond what was owed, kept as credit. */
  credit: number;
  /** What the customer must pay now to move forward (0 when nothing is due). */
  dueNow: number;
  duePurpose: PaymentPurpose | null;
  payments: OrderPayment[];
  events: OrderEvent[];
  notifications: OrderNotification[];
  progress: OrderProgress;
  proofs: Proof[];
  survey: { preferred: string[]; booked: string | null } | null;
};

/** How a visitor proves an order is theirs: the secret link, or the phone used to order. */
export type OrderAccess = { token: string } | { phone: string };

export type OrderErrorCode = 'not_found' | 'invalid' | 'invalid_state';

/** Thrown by the order methods; the message is safe to show the customer. */
export class OrderError extends Error {
  constructor(
    public code: OrderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}
