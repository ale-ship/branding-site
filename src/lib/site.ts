/** Business details and navigation. Components read these; never hard-code them. */

export const site = {
  name: 'Noorcom Branding',
  shortName: 'Noorcom',
  tagline: 'Printing and branding, designed and made in Nairobi.',
  description:
    'Noorcom Branding designs, prints and installs signage, vehicle branding, apparel, corporate gifts and stationery for businesses across Kenya.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  phone: '+254 722 530 301',
  phoneHref: 'tel:+254722530301',
  whatsappHref: 'https://wa.me/254722530301',
  email: 'info@noorcombranding.co.ke',
  location: 'Nairobi, Kenya',
  /** Same premises as Noorcom Computers (owner, 3 Oct 2026). */
  address: 'Chuka Elimu Plaza, 1st Floor, Loita Street, Nairobi',
  postalAddress: {
    streetAddress: 'Chuka Elimu Plaza, 1st Floor, Loita Street',
    addressLocality: 'Nairobi',
    addressCountry: 'KE',
  },
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Chuka+Elimu+Plaza%2C+Loita+Street%2C+Nairobi',
  // TODO(business): opening hours and social links are not confirmed yet.
  hours: null as string | null,
  socials: [] as { label: string; href: string }[],
} as const;

/**
 * Who issues invoices and how to pay, from Noorcom's invoice template (5 Oct 2026).
 *
 * The template shows 0722723352 and a staff email; the spec routes all contact through the main
 * number, so invoices use `site.phone` and `site.email`. TODO(business): confirm.
 *
 * TODO(business): Absa's Paybill 303030 takes the bank account number as the M-Pesa account
 * number, so a Paybill payment can't carry the order number. Matching payments to orders
 * automatically (spec, "Payments") needs a dedicated Paybill or till, or Absa C2B with the order
 * number as the account reference.
 */
export const invoiceIssuer = {
  legalName: 'Noorcom Branding Limited',
  addressLine: 'Nairobi 50750, Kenya',
  tagline: 'Design | Print | Brand',
  bank: 'ABSA Bank PLC',
  accountName: 'Noorcom Branding Limited',
  paybill: '303030',
  accountNo: '2055268420',
} as const;

export type NavItem = { label: string; href: string };

/** Main navigation, in the header, the menu overlay and the footer. */
export const mainNav: NavItem[] = [
  { label: 'Work', href: '/work' },
  { label: 'Services', href: '/services' },
  { label: 'Shop', href: '/shop' },
  { label: 'Order', href: '/order' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export const quoteHref = '/quote';
