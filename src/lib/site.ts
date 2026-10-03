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
  // TODO(business): street address, opening hours and social links are not confirmed yet.
  address: null as string | null,
  hours: null as string | null,
  socials: [] as { label: string; href: string }[],
} as const;

export type NavItem = { label: string; href: string };

/** Main navigation, in the header, the menu overlay and the footer. */
export const mainNav: NavItem[] = [
  { label: 'Work', href: '/work' },
  { label: 'Services', href: '/services' },
  { label: 'Shop', href: '/shop' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export const quoteHref = '/quote';
