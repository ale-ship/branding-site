import type { CapacityCalendar } from '../capacity';

/**
 * The site's data contract. Pages and components talk to `api` (src/lib/api/index.ts) only,
 * never to the files in ./data. Today the mock serves it; our own backend will later.
 */

import type {
  Account,
  AccountSession,
  ApprovalChecklist,
  BrandKit,
  CompanyMember,
  Order,
  OrderAccess,
  OrderCategory,
  OrderInput,
  OrderPayment,
  OrderProduct,
  PriceEstimate,
  PriceRequest,
  ProofPin,
  ReorderDraft,
  SavedAddress,
  Statement,
} from './order-types';


/** A photo in public/images. `alt` describes it for screen readers. */
export type Photo = { src: string; alt: string };

export type ServiceSlug =
  | 'indoor-branding'
  | 'outdoor-branding'
  | 'vehicle-branding'
  | 'apparel'
  | 'corporate-gifts'
  | 'stationery'
  | 'large-format';

export type Service = {
  slug: ServiceSlug;
  name: string;
  /** One line for lists. */
  summary: string;
  /** A short paragraph for the service page. */
  intro: string;
  /** Things we make under this service, shown as tags. */
  includes: string[];
  materials: string[];
  /** Typical time from approved proof to finished job, e.g. "3 to 5 working days". */
  turnaround: string;
  /** Smallest job we take, e.g. "50 pieces" or "One sign". */
  minimum: string;
  /** Shop categories that belong to this service, for "Ready to brand" on its page. */
  productCategories: ProductCategory[];
  faqs: { question: string; answer: string }[];
  image: Photo;
};

/** A photo with an optional line under it. */
export type CaptionedPhoto = Photo & { caption?: string };

/**
 * A job, told as a case study (Mindsparkle's order): brief, idea, colours, applications,
 * behind the scenes, before and after (rebrands only), result.
 */
export type Project = {
  slug: string;
  title: string;
  client: string;
  industry: string;
  year: number;
  location: string;
  services: ServiceSlug[];
  /** One or two sentences for cards and the case-study intro. */
  summary: string;
  cover: Photo;
  /** The job's colours as hex values, shown as swatch chips. */
  palette: string[];
  brief: string;
  idea: string;
  result: string;
  /** Short numbers worth bragging about: `{ label: 'Vans wrapped', value: '12' }`. */
  facts: { label: string; value: string }[];
  /** Materials and finishes, the details a print buyer cares about. */
  materials: string[];
  /** The work in use: signage up, vans on the road, gifts on desks. */
  applications: CaptionedPhoto[];
  /** Production: machines, proofs, installation. */
  behindTheScenes: CaptionedPhoto[];
  /** Only for rebrands. */
  beforeAfter: { before: Photo; after: Photo } | null;
  featured: boolean;
  /** True for placeholder projects that must be replaced with real work before launch. */
  sample: boolean;
};

export type ProductCategory = 'stationery' | 'print' | 'apparel' | 'gifts' | 'display';

/** A choice the customer makes on the product page, e.g. Finish: Matte, Gloss. */
export type ProductOption = { name: string; values: string[] };

export type Product = {
  slug: string;
  name: string;
  category: ProductCategory;
  /** The service it belongs to, for turnaround and "how we make it". */
  service: ServiceSlug;
  /** Price per piece in whole shillings. */
  pricePerPiece: number;
  /** Minimum order quantity in pieces. */
  minQuantity: number;
  summary: string;
  /** A short paragraph for the product page. */
  description: string;
  /** The first value of each option is the default. */
  options: ProductOption[];
  image: Photo;
  featured: boolean;
};

export type Client = { name: string; logo: Photo | null };

export type ListOptions = { featured?: boolean; limit?: number };

export type FulfilmentMethod = 'collect' | 'deliver' | 'install';
export type ContactChannel = 'whatsapp' | 'phone' | 'email';

/** Artwork the customer attached. Only the details travel for now; see docs/RUNBOOK.md (Phase 3). */
export type ArtworkFile = { name: string; size: number; type: string };

/** A quote request as sent from /quote, already validated (src/lib/quote.ts). */
/** A shop item in a quote: which product, how many, and the options chosen. */
export type QuoteItem = { slug: string; quantity: number; options: Record<string, string> };

export type QuoteRequest = {
  /** Empty when the request is only shop items. */
  service: ServiceSlug | '';
  /** Shop items from the quote list. */
  products: QuoteItem[];
  /** For the service job; 0 when the request is only shop items. */
  quantity: number;
  details: string;
  artwork: ArtworkFile[];
  needsDesign: boolean;
  /** YYYY-MM-DD, or empty for "no fixed date". */
  deadline: string;
  fulfilment: FulfilmentMethod;
  /** Where to deliver or install; empty when collecting. */
  location: string;
  name: string;
  company: string;
  /** Normalised to +2547XXXXXXXX / +2541XXXXXXXX. */
  phone: string;
  email: string;
  preferredContact: ContactChannel;
};

export type QuoteReceipt = { reference: string };

/** A message from the contact form, already validated (src/lib/contact.ts). */
export type ContactMessage = { name: string; phone: string; email: string; message: string };

export interface SiteApi {
  listServices(): Promise<Service[]>;
  getService(slug: string): Promise<Service | null>;
  /** Newest first. */
  listProjects(options?: ListOptions): Promise<Project[]>;
  getProject(slug: string): Promise<Project | null>;
  listProducts(options?: ListOptions): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  listClients(): Promise<Client[]>;
  submitQuote(request: QuoteRequest): Promise<QuoteReceipt>;
  sendMessage(message: ContactMessage): Promise<QuoteReceipt>;

  // Online ordering (docs/ORDER_WORKFLOW_SPEC.md). The order methods throw OrderError.
  listOrderCategories(): Promise<OrderCategory[]>;
  listOrderProducts(): Promise<OrderProduct[]>;
  getOrderProduct(slug: string): Promise<OrderProduct | null>;
  /** Pieces booked per machine per day, so the order form only offers deadlines the workshop can meet. */
  getCapacity(): Promise<CapacityCalendar>;
  /** The live price for a brief, quantity, deadline tier and handover. */
  priceEstimate(request: PriceRequest): Promise<PriceEstimate>;
  /** Prices the order again (the browser's price is never trusted) and opens it, awaiting payment. */
  createOrder(input: OrderInput): Promise<{ ref: string; token: string }>;
  /** Sends an M-Pesa STK Push for what's due now. The order moves on only when the callback confirms. */
  startPayment(ref: string, access: OrderAccess, phone: string): Promise<OrderPayment>;
  getOrder(ref: string, access: OrderAccess): Promise<Order | null>;
  /** Approves one proof version; every checklist item must be confirmed. Locks the artwork. */
  approveProof(ref: string, access: OrderAccess, version: number, checklist: ApprovalChecklist): Promise<Order>;
  /** Sends a proof back with notes and pins; uses a revision round. */
  requestChanges(ref: string, access: OrderAccess, version: number, comments: string, pins: ProofPin[]): Promise<Order>;
  /** Approves the pre-production sample (the full run starts) or asks for changes to it. */
  reviewSample(ref: string, access: OrderAccess, decision: 'approve' | 'changes', comments: string): Promise<Order>;
  /** Asks for finished pieces to be delivered early, as their own delivery. */
  requestPartialDelivery(ref: string, access: OrderAccess, pieces: number): Promise<Order>;
  bookSurvey(ref: string, access: OrderAccess, date: string): Promise<Order>;
  /** Site jobs: accepts the firm quote after the survey; the deposit then falls due. */
  acceptSiteQuote(ref: string, access: OrderAccess): Promise<Order>;
  /** Site jobs: books (or moves) the installation date while the job is in production. */
  bookInstall(ref: string, access: OrderAccess, date: string): Promise<Order>;

  // Accounts (spec, "Accounts"): phone + a one-time code on WhatsApp. Orders placed with the phone
  // belong to the account, guest orders included. Methods taking a session throw OrderError when
  // it has expired.
  /** Sends a sign-in code on WhatsApp. `demoCode` is filled by the mock only, never by the backend. */
  requestSignInCode(phone: string): Promise<{ sentTo: string; demoCode?: string }>;
  verifySignInCode(phone: string, code: string): Promise<AccountSession>;
  getAccount(session: string): Promise<Account | null>;
  updateAccount(session: string, details: { name: string; email: string; company: string }): Promise<Account>;
  saveBrandKit(session: string, kit: BrandKit): Promise<Account>;
  saveAddress(session: string, address: Omit<SavedAddress, 'id'> & { id?: string }): Promise<Account>;
  removeAddress(session: string, id: string): Promise<Account>;
  /** The past order's choices for a new order, with its approved artwork (no design fee). */
  reorderDraft(session: string, ref: string): Promise<ReorderDraft>;
  signOut(session: string): Promise<void>;
  /** Invoices and payments for the account's own orders, with a running balance. */
  getStatement(session: string): Promise<Statement>;
  createCompany(session: string, details: { name: string; kraPin: string }): Promise<Account>;
  /** Owners only. Adding a phone that already belongs to a company is refused. */
  addCompanyMember(session: string, member: CompanyMember): Promise<Account>;
  removeCompanyMember(session: string, phone: string): Promise<Account>;
}

export type * from './order-types';
