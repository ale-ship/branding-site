import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

/**
 * Search engines may crawl everything. `/_next/` must stay open: Google needs its CSS, scripts and
 * optimised images to render the pages. Set NEXT_PUBLIC_SITE_URL to the live address
 * (https://noorcombranding.co.ke) so the sitemap link and canonical URLs are right.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: new URL('/sitemap.xml', site.url).toString(),
    host: site.url,
  };
}
