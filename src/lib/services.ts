import type { Product, Project, Service } from './api/types';

export const serviceHref = (slug: string) => `/services/${slug}`;

/** The quote form, with this service already chosen. */
export const serviceQuoteHref = (slug: string) => `/quote?service=${encodeURIComponent(slug)}`;

/** Projects that used this service, newest first, up to `limit`. */
export function relatedProjects(service: Service, projects: Project[], limit = 3): Project[] {
  return projects.filter((p) => p.services.includes(service.slug)).slice(0, limit);
}

/** Shop items in this service's categories, featured first, up to `limit`. */
export function relatedProducts(service: Service, products: Product[], limit = 4): Product[] {
  return products
    .filter((p) => service.productCategories.includes(p.category))
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, limit);
}
