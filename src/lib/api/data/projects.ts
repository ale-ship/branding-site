import type { Client, Project } from '../types';

const img = (name: string, alt: string) => ({ src: `/images/placeholder/${name}.jpg`, alt });

/**
 * SAMPLE projects so the layouts can be reviewed. None of these are real Noorcom jobs:
 * every one has `sample: true` and shows a "Sample" tag. Replace them with real case studies
 * (RUNBOOK.md section 8) before launch.
 */
export const projects: Project[] = [
  {
    slug: 'sample-fleet-livery',
    title: 'A delivery fleet you notice from across the road',
    client: 'Sample client',
    industry: 'Logistics',
    year: 2026,
    location: 'Nairobi',
    services: ['vehicle-branding'],
    summary: 'Full wraps for a fleet of delivery vans, designed to read at speed.',
    cover: img('van-wrap', 'A white van covered in a full graphic wrap'),
    palette: ['#f2f2f0', '#e85a8a', '#1b1b1b'],
    featured: true,
    sample: true,
  },
  {
    slug: 'sample-office-mural',
    title: 'An office that says who works there',
    client: 'Sample client',
    industry: 'Technology',
    year: 2026,
    location: 'Westlands',
    services: ['indoor-branding'],
    summary: 'A lounge mural, wayfinding and frosted glass for a new head office.',
    cover: img('wall-mural', 'An office lounge with a large illustrated wall mural'),
    palette: ['#f6c945', '#7fb7c9', '#2f6b3a'],
    featured: true,
    sample: true,
  },
  {
    slug: 'sample-event-apparel',
    title: 'Five hundred tees, one weekend',
    client: 'Sample client',
    industry: 'Events',
    year: 2025,
    location: 'Nairobi',
    services: ['apparel'],
    summary: 'Crew and fan t-shirts printed and packed in three days.',
    cover: img('tshirt-print', 'Close-up of a bold multicolour print on a white t-shirt'),
    palette: ['#ffffff', '#2e9e4f', '#111111'],
    featured: true,
    sample: true,
  },
  {
    slug: 'sample-billboard-campaign',
    title: 'A launch campaign across the city',
    client: 'Sample client',
    industry: 'Retail',
    year: 2025,
    location: 'Nairobi and Mombasa',
    services: ['outdoor-branding', 'large-format'],
    summary: 'Billboards and banners printed in-house and installed in two cities.',
    cover: img('billboard-city', 'A billboard on a city terrace between buildings'),
    palette: ['#ffffff', '#16244a', '#f07f22'],
    featured: true,
    sample: true,
  },
  {
    slug: 'sample-corporate-gifts',
    title: 'Gifts that stay on the desk',
    client: 'Sample client',
    industry: 'Finance',
    year: 2025,
    location: 'Upper Hill',
    services: ['corporate-gifts'],
    summary: 'Year-end gift sets: bottles, notebooks and bags in the client’s colours.',
    cover: img('water-bottles', 'Three pastel metal water bottles'),
    palette: ['#f4a259', '#7fd1c7', '#c9a0dc'],
    featured: true,
    sample: true,
  },
  {
    slug: 'sample-stationery-system',
    title: 'Stationery for a growing practice',
    client: 'Sample client',
    industry: 'Professional services',
    year: 2024,
    location: 'Kilimani',
    services: ['stationery'],
    summary: 'Business cards, letterheads and a company profile booklet.',
    cover: img('business-cards', 'Two stacks of blank business cards'),
    palette: ['#ffffff', '#d9d6d0', '#0f1a2e'],
    featured: true,
    sample: true,
  },
];

/** TODO(business): real client logos, with permission to show them. */
export const clients: Client[] = Array.from({ length: 8 }, (_, i) => ({
  name: `Client ${String(i + 1).padStart(2, '0')}`,
  logo: null,
}));
