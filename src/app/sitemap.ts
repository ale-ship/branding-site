import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { serviceHref } from '@/lib/services';
import { productHref } from '@/lib/shop';
import { site } from '@/lib/site';
import { projectHref } from '@/lib/work';

/**
 * Every indexable page. Sample projects are left out (they're noindex placeholders), as are
 * filtered views, the quote form's states and the legal drafts' anchors.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, projects, products] = await Promise.all([api.listServices(), api.listProjects(), api.listProducts()]);
  const url = (path: string) => new URL(path, site.url).toString();
  const fixed: MetadataRoute.Sitemap = [
    { url: url('/'), changeFrequency: 'weekly', priority: 1 },
    { url: url('/work'), changeFrequency: 'weekly', priority: 0.9 },
    { url: url('/services'), changeFrequency: 'monthly', priority: 0.9 },
    { url: url('/shop'), changeFrequency: 'weekly', priority: 0.8 },
    { url: url('/quote'), changeFrequency: 'yearly', priority: 0.8 },
    { url: url('/about'), changeFrequency: 'yearly', priority: 0.6 },
    { url: url('/contact'), changeFrequency: 'yearly', priority: 0.6 },
    { url: url('/privacy'), changeFrequency: 'yearly', priority: 0.2 },
    { url: url('/terms'), changeFrequency: 'yearly', priority: 0.2 },
  ];
  return [
    ...fixed,
    ...services.map((s) => ({ url: url(serviceHref(s.slug)), changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...projects.filter((p) => !p.sample).map((p) => ({ url: url(projectHref(p.slug)), changeFrequency: 'yearly' as const, priority: 0.7 })),
    ...products.map((p) => ({ url: url(productHref(p.slug)), changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
