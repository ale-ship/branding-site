// @ts-check
import { fileURLToPath } from 'node:url';

/**
 * Who Noorcom is, on the back office's PDFs. The site keeps the same details in src/lib/site.ts
 * (`site` and `invoiceIssuer`), which the backend may not import: change both together.
 */
export const LETTERHEAD = {
  legalName: 'Noorcom Branding Limited',
  tagline: 'Design | Print | Brand',
  address: 'Chuka Elimu Plaza, 1st Floor, Loita Street, Nairobi 50750, Kenya',
  phone: '+254 722 530 301',
  email: 'info@noorcombranding.co.ke',
  web: 'noorcombranding.co.ke',
  /** The full logo, a copy of the site's public/brand/nb-logo.png. */
  logo: fileURLToPath(new URL('../../assets/nb-logo.png', import.meta.url)),
};

/** The logo's red and the site's ink (src/app/globals.css). */
export const INK = { red: '#ff0001', heading: '#111111', body: '#2b2b2b', muted: '#5e5e5e', border: '#e2ddd3', panel: '#f5f2ec' };
