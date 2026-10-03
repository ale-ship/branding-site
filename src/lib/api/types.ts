/**
 * The site's data contract. Pages and components talk to `api` (src/lib/api/index.ts) only,
 * never to the files in ./data. Today the mock serves it; our own backend will later.
 */

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

export type Product = {
  slug: string;
  name: string;
  category: ProductCategory;
  /** Price per piece in whole shillings. */
  pricePerPiece: number;
  /** Minimum order quantity in pieces. */
  minQuantity: number;
  summary: string;
  image: Photo;
  featured: boolean;
};

export type Client = { name: string; logo: Photo | null };

export type ListOptions = { featured?: boolean; limit?: number };

export type FulfilmentMethod = 'collect' | 'deliver' | 'install';
export type ContactChannel = 'whatsapp' | 'phone' | 'email';

/** Artwork the customer attached. Only the details travel for now; see RUNBOOK.md (Phase 3). */
export type ArtworkFile = { name: string; size: number; type: string };

/** A quote request as sent from /quote, already validated (src/lib/quote.ts). */
export type QuoteRequest = {
  service: ServiceSlug;
  /** Shop items the customer added, by product slug (Phase 4). */
  products: string[];
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

export interface SiteApi {
  listServices(): Promise<Service[]>;
  getService(slug: string): Promise<Service | null>;
  /** Newest first. */
  listProjects(options?: ListOptions): Promise<Project[]>;
  getProject(slug: string): Promise<Project | null>;
  listProducts(options?: ListOptions): Promise<Product[]>;
  listClients(): Promise<Client[]>;
  submitQuote(request: QuoteRequest): Promise<QuoteReceipt>;
}
