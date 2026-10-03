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
  /** Things we make under this service, shown as tags. */
  includes: string[];
  image: Photo;
};

export type Project = {
  slug: string;
  title: string;
  client: string;
  industry: string;
  year: number;
  location: string;
  services: ServiceSlug[];
  summary: string;
  cover: Photo;
  /** The job's colours as hex values, shown as swatch chips. */
  palette: string[];
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

export interface SiteApi {
  listServices(): Promise<Service[]>;
  listProjects(options?: ListOptions): Promise<Project[]>;
  listProducts(options?: ListOptions): Promise<Product[]>;
  listClients(): Promise<Client[]>;
}
