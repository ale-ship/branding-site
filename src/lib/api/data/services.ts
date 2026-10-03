import type { Service } from '../types';

const img = (name: string, alt: string) => ({ src: `/images/placeholder/${name}.jpg`, alt });

/** TODO(business): service wording is a first draft for Noorcom to confirm. */
export const services: Service[] = [
  {
    slug: 'indoor-branding',
    name: 'Indoor branding',
    summary: 'Offices, receptions and shops turned into spaces that tell your story.',
    includes: ['Wall murals', 'Frosted glass', 'Reception signs', 'Wayfinding', '3D letters'],
    image: img('wall-mural', 'An office lounge with a large illustrated wall mural'),
  },
  {
    slug: 'outdoor-branding',
    name: 'Outdoor branding',
    summary: 'Shop fronts, billboards and signs that stop people in the street.',
    includes: ['Shop-front signs', 'Billboards', 'Light boxes', 'Pylons', 'Banners'],
    image: img('billboard', 'A roadside billboard against a pale sky'),
  },
  {
    slug: 'vehicle-branding',
    name: 'Vehicle branding',
    summary: 'Full and partial wraps that turn every trip into an advert.',
    includes: ['Full wraps', 'Partial wraps', 'Door decals', 'Fleet livery'],
    image: img('van-wrap', 'A white van covered in a full graphic wrap'),
  },
  {
    slug: 'apparel',
    name: 'Apparel printing',
    summary: 'Uniforms, t-shirts and hoodies printed to last the wash.',
    includes: ['T-shirts', 'Hoodies', 'Uniforms', 'Caps', 'Screen printing', 'Heat transfer'],
    image: img('heat-press', 'A man preparing a black t-shirt on a heat press'),
  },
  {
    slug: 'corporate-gifts',
    name: 'Corporate gifts',
    summary: 'Branded gifts people actually keep: mugs, bottles, umbrellas and bags.',
    includes: ['Mugs', 'Water bottles', 'Umbrellas', 'Gift bags', 'Notebooks'],
    image: img('water-bottles', 'Three pastel metal water bottles on a white surface'),
  },
  {
    slug: 'stationery',
    name: 'Stationery and print',
    summary: 'Business cards, letterheads, brochures and booklets, sharp and on time.',
    includes: ['Business cards', 'Letterheads', 'Brochures', 'Booklets', 'Posters', 'Logo design'],
    image: img('business-cards', 'Two stacks of blank business cards'),
  },
  {
    slug: 'large-format',
    name: 'Large-format printing',
    summary: 'Banners, roll-ups and backdrops printed in-house on wide-format machines.',
    includes: ['Banner stands', 'Backdrops', 'Vinyl stickers', 'Canvas', 'Posters'],
    image: img('print-wide-format', 'A wide-format printer feeding out a long pink banner'),
  },
];
