/**
 * Online ordering (docs/ORDER_WORKFLOW_SPEC.md): the data contract between the site and the backend.
 * Declarations only, read by the site (TypeScript) and by the backend and shared rules (JSDoc). The
 * runtime error class is in ./errors.js. The site's mock implements it today; the backend will.
 */
import type { ArtworkFile, Photo, ServiceSlug } from './content.js';

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

/**
 * A note pinned on a proof ("make the logo bigger here"). `x` and `y` are fractions of the image's
 * width and height (0 to 1); null for a note about the whole proof.
 */
export type ProofPin = { x: number | null; y: number | null; text: string };

export type Proof = {
  version: number;
  status: 'pending' | 'approved' | 'changes_requested';
  uploadedAt: string;
  note: string;
  /** The customer's general notes when they asked for changes. */
  comments: string | null;
  pins: ProofPin[];
  /** The flat artwork, watermarked PROOF: a signed link from the backend, a drawn SVG in the mock. */
  image: string;
  /** The design shown on the real item, when there is one. */
  mockup: string | null;
  decidedAt: string | null;
};

/** What the customer confirms before approving a proof (spec, "Customer actions on a proof"). */
export type ApprovalChecklist = { spelling: boolean; colours: boolean; size: boolean; quantity: boolean; colourVariance: boolean };

/**
 * The pre-production sample for big runs (Mechanism A): one piece printed and photographed, approved
 * before the full run. `waiting` until staff upload the photo.
 */
export type SampleCheck = {
  status: 'waiting' | 'pending' | 'approved' | 'changes_requested';
  photo: string | null;
  uploadedAt: string | null;
  comments: string | null;
};

/** One entry from the production floor: "120 printed". */
export type ProductionLog = { at: string; pieces: number; note: string };

export type Production = {
  logs: ProductionLog[];
  /** Pieces a day this product's machines turn out (the ETA divides by it until there's a real rate). */
  dailyCapacity: number | null;
  /** YYYY-MM-DD the run started: proof approved and balance paid. Dates count from here. */
  startedOn: string | null;
  /** YYYY-MM-DD promised to the customer, set when production starts. */
  promisedBy: string | null;
};

/** A delivery: the whole order, or an early batch (partial delivery). */
export type Delivery = {
  id: string;
  pieces: number;
  partial: boolean;
  status: 'requested' | 'out' | 'delivered';
  rider: string | null;
  riderPhone: string | null;
  /** Courier waybill, for countrywide deliveries. */
  waybill: string | null;
  recipient: string | null;
  requestedAt: string;
  deliveredAt: string | null;
};

/** One measured item on a site job's firm quote, e.g. "Reception wall, 4.2 × 2.6 m, wallpaper". */
export type SiteQuoteItem = { label: string; widthCm: number; heightCm: number; material: SiteMaterial; quantity: number };

export type SiteMaterial = 'vinyl' | 'wallpaper' | 'frosted' | 'acp-sign' | 'lightbox' | 'flex-banner' | 'vehicle-wrap';

/**
 * The firm price after the survey (Mechanism B), made by staff in the quote builder and accepted by the
 * customer online. The survey fee comes off the total.
 */
export type SiteQuote = {
  issuedAt: string;
  /** YYYY-MM-DD; after this the quote must be refreshed. */
  validUntil: string;
  status: 'pending' | 'accepted';
  acceptedAt: string | null;
  surveyNotes: string;
  items: SiteQuoteItem[];
  lines: PriceLine[];
  total: number;
  /** Half the total, paid on acceptance; the survey fee comes off the balance at sign-off. */
  deposit: number;
};

/** How the order was finally handed over (spec, "Fulfilment": proof of handover). */
export type HandoverRecord = { at: string; method: Handover['method']; detail: string };

export type OrderProgress =
  | { kind: 'pieces'; done: number; total: number }
  | { kind: 'stages'; done: number; total: number; stages: { name: string; done: boolean }[] }
  | { kind: 'rounds'; done: number; total: number };

export type Customer = { name: string; company: string; phone: string; email: string };

export type OrderInput = PriceRequest & {
  common: CommonBrief;
  customer: Customer;
  /** Set by the server from the signed-in account, never from the browser; the PO number is the customer's. */
  company?: { id: string; poNumber: string };
};

/** A company order: whose it is, the customer's PO or LPO number, and who approves its proofs. */
export type OrderCompany = { id: string; name: string; poNumber: string; approvers: string[] };

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
  /** Site jobs: the firm quote once the survey is done. */
  siteQuote: SiteQuote | null;
  /** Site jobs: the installation date the customer chose (YYYY-MM-DD). */
  installDate: string | null;
  /** Null when the run is too small to need one. */
  sample: SampleCheck | null;
  production: Production;
  /** Six digits, given when the order is ready for pickup; staff check it at the counter. */
  pickupCode: string | null;
  deliveries: Delivery[];
  handedOver: HandoverRecord | null;
  company: OrderCompany | null;
};

// ── Accounts (spec, "Accounts") ─────────────────────────────────────────────

/** Saved once, filled into every new brief: the main reason to have an account. */
export type BrandKit = {
  colours: string[];
  typography: CommonBrief['typography'];
  fonts: string;
  /** Logo files. Only names and sizes travel until the backend takes uploads. */
  logos: ArtworkFile[];
  notes: string;
};

export type SavedAddress = { id: string; label: string; address: string; zone: DeliveryZone };

/** A line in the account's order list. */
export type OrderSummary = {
  ref: string;
  createdAt: string;
  status: OrderStatus;
  productName: string;
  productSlug: string;
  mechanism: Mechanism;
  quantity: number;
  total: number | null;
  amountPaid: number;
  invoiceNo: string;
  /** A finished, approved design that can be printed again without redesign. */
  canReorder: boolean;
};

export type CompanyRole = 'owner' | 'approver' | 'member';
export type CompanyMember = { phone: string; name: string; role: CompanyRole };

/**
 * Several people ordering for one company (spec, "Accounts": company accounts). Members' orders need
 * an owner's or approver's OK on the proof; the PO number goes on the invoice.
 */
export type Company = { id: string; name: string; kraPin: string; members: CompanyMember[] };

/** One line of a statement of account: an invoice (debit) or a payment (credit). */
export type StatementLine = { date: string; ref: string; document: string; description: string; debit: number; credit: number; balance: number };
export type Statement = { lines: StatementLine[]; invoiced: number; paid: number; balance: number };

export type Account = {
  phone: string;
  name: string;
  email: string;
  company: string;
  brandKit: BrandKit | null;
  addresses: SavedAddress[];
  /** Every order placed with this phone, newest first: guest orders join the account by themselves. */
  orders: OrderSummary[];
  credit: number;
  /** The company this phone belongs to, with its role there. */
  companyAccount: (Company & { role: CompanyRole }) | null;
  /** Other members' orders, for owners and approvers. */
  companyOrders: (OrderSummary & { placedBy: string })[];
};

/** A signed-in visitor: the session token from the sign-in code. */
export type AccountSession = { session: string };

/** What reordering fills in: the past order's choices, with its approved artwork and no design fee. */
export type ReorderDraft = Pick<OrderInput, 'product' | 'quantity' | 'brief' | 'urgency' | 'handover' | 'common'> & { from: string };

/** How a visitor proves an order is theirs: the secret link, or the phone used to order. */
export type OrderAccess = { token: string } | { phone: string };

export type OrderErrorCode = 'not_found' | 'invalid' | 'invalid_state';
