/** Content types: the order contract's, and the site's content, which staff edit in the back office. */

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

/** A file the customer picked. Only the name, size and type travel until uploads go to storage. */
export type ArtworkFile = { name: string; size: number; type: string };

/*
 * The site's content (owner, 8 Oct 2026: staff edit it in the back office, so it lives in the
 * backend's database, seeded from shared/content/). The site's src/lib/api/types.ts re-exports these.
 */

/** Shop categories. */
export type ProductCategory = 'stationery' | 'print' | 'apparel' | 'gifts' | 'display';

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
  /** Smallest job we take, e.g. "10 pieces" or "One sign". */
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

/** A choice the customer makes on the product page, e.g. Finish: Matte, Gloss. */
export type ProductOption = { name: string; values: string[] };

export type Product = {
  slug: string;
  name: string;
  category: ProductCategory;
  /** The service it belongs to, for turnaround and "how we make it". */
  service: ServiceSlug;
  /** Price per piece in whole shillings (in live mode, the order catalogue's first tier). */
  pricePerPiece: number;
  /** Minimum order quantity in pieces (in live mode, the order catalogue's). */
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

/** A heading with the small line above it. */
export type SectionHeading = { eyebrow: string; title: string };

/** The home page's fixed sections, each with its words and photos editable. */
export type HomePage = {
  hero: { latestTitle: string; latestSubtitle: string; discoverTitle: string; discoverSubtitle: string };
  workshop: { image: Photo; caption: string; facts: { value: string; label: string }[] };
  inHouse: SectionHeading & { text: string; buttonLabel: string; images: Photo[] };
  process: SectionHeading & { steps: { name: string; text: string }[] };
  clients: { title: string };
  cta: SectionHeading & { text: string };
};

/** The About page's sections. */
export type AboutPage = {
  header: { title: string; intro: string };
  image: Photo;
  story: string[];
  principles: SectionHeading & { items: { title: string; text: string }[] };
  workshop: SectionHeading & { photos: CaptionedPhoto[] };
};

/** Everything on the site's fixed pages that staff edit. */
export type PageContent = { home: HomePage; about: AboutPage };
