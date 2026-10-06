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
 * Who issues invoices and receipts, and how to pay (Noorcom's template, 5 Oct 2026; confirmed 6 Oct):
 * the main number and info@ on every document; Absa's Paybill 303030 into the Absa account.
 */
const ABSA_ACCOUNT = '2055268420';

export const invoiceIssuer = {
  legalName: 'Noorcom Branding Limited',
  addressLine: 'Nairobi 50750, Kenya',
  tagline: 'Design | Print | Brand',
  bank: 'ABSA Bank PLC',
  accountName: 'Noorcom Branding Limited',
  paybill: '303030',
  accountNo: ABSA_ACCOUNT,
  /**
   * What the customer types as the M-Pesa "Account number" on Absa's Paybill: the bank account,
   * then `#` and the order number, so Absa's C2B confirmation carries it in BillRefNumber and the
   * payment is matched to the order automatically (src/lib/payments/c2b.ts).
   * TODO(business): confirm with Absa the exact account format their C2B accepts; the matcher
   * finds the order number anywhere in the reference, so only this line would change.
   */
  paybillAccount: (orderRef: string) => `${ABSA_ACCOUNT}#${orderRef.replace('-', '')}`,
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
