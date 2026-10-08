import type { Service } from '../types';

const img = (name: string, alt: string) => ({ src: `/images/placeholder/${name}.jpg`, alt });

/**
 * TODO(business): all service wording, materials, turnaround times, minimums and FAQ answers are
 * a first draft for Noorcom to confirm.
 */
export const services: Service[] = [
  {
    slug: 'indoor-branding',
    name: 'Indoor branding',
    summary: 'Offices, receptions and shops turned into spaces that tell your story.',
    intro:
      'Your walls, glass and doors are the first thing visitors and staff see every day. We design, print and fit everything inside: murals, frosted glass, reception signs and wayfinding, usually over a weekend so you never close.',
    includes: ['Wall murals', 'Frosted glass', 'Reception signs', 'Wayfinding', '3D letters', 'Window graphics'],
    materials: ['Printed wallpaper (latex inks, safe indoors)', 'Frosted and printed window film', 'Acrylic and aluminium signs', 'Brushed steel and painted 3D letters'],
    turnaround: '5 to 10 working days',
    minimum: 'One sign',
    productCategories: ['display'],
    faqs: [
      { question: 'Can you install outside working hours?', answer: 'Yes. Most office installs happen in the evening or over a weekend so your team isn’t disturbed.' },
      { question: 'Will a wall mural damage the paint?', answer: 'No. We use removable wallpaper and films that come off cleanly when you move or rebrand.' },
      { question: 'Do you measure the space first?', answer: 'Yes. We visit, measure and photograph the space before we design, at no charge within Nairobi.' },
    ],
    image: img('wall-mural', 'An office lounge with a large illustrated wall mural'),
  },
  {
    slug: 'outdoor-branding',
    name: 'Outdoor branding',
    summary: 'Shop fronts, billboards and signs that stop people in the street.',
    intro:
      'Outdoor signs have to work at a distance, in the sun and through the rains. We make shop fronts, light boxes, pylons, billboards and banners that stay bright for years, and we handle the installation.',
    includes: ['Shop-front signs', 'Billboards', 'Light boxes', 'Pylons', 'Banners', 'Flags'],
    materials: ['Aluminium composite panel', 'Frontlit and backlit flex', 'UV-resistant inks and laminates', 'LED modules for light boxes'],
    turnaround: '7 to 14 working days',
    minimum: 'One sign',
    productCategories: ['display'],
    faqs: [
      { question: 'Do you handle county signage approvals?', answer: 'We can prepare the drawings and guide you through the county’s advertising permit; the permit itself is issued to you.' },
      { question: 'How long do outdoor prints last?', answer: 'With UV-resistant inks and laminate, three to five years in Nairobi sun, depending on the material.' },
      { question: 'Can you work at height?', answer: 'Yes. Our installers have the access equipment for shop fronts and building signs.' },
    ],
    image: img('billboard', 'A roadside billboard against a pale sky'),
  },
  {
    slug: 'vehicle-branding',
    name: 'Vehicle branding',
    summary: 'Full and partial wraps that turn every trip into an advert.',
    intro:
      'A branded vehicle is seen by thousands of people every day. We design wraps that read at speed, print them on cast vinyl, and fit them in our workshop, from a single car to a whole fleet.',
    includes: ['Full wraps', 'Partial wraps', 'Door decals', 'Fleet livery', 'Window perforated film'],
    materials: ['Cast vinyl with air-release adhesive', 'Gloss or matte laminate', 'One-way vision window film', 'Reflective vinyl'],
    turnaround: '2 to 4 days per vehicle',
    minimum: 'One vehicle',
    productCategories: [],
    faqs: [
      { question: 'Will a wrap damage my paint?', answer: 'No. Quality cast vinyl protects the paint underneath and peels off cleanly when you sell the vehicle.' },
      { question: 'How long does a wrap take?', answer: 'Two to four days per vehicle in our workshop. For fleets we wrap a few at a time so your vehicles keep working.' },
      { question: 'Do I need to tell NTSA?', answer: 'A full colour change may need to be recorded. We’ll tell you when it applies.' },
    ],
    image: img('van-wrap', 'A white van covered in a full graphic wrap'),
  },
  {
    slug: 'apparel',
    name: 'Apparel printing',
    summary: 'Uniforms, t-shirts and hoodies printed to last the wash.',
    intro:
      'From staff uniforms to event t-shirts, we print and embroider clothing that still looks good after fifty washes. Screen printing for bigger runs, heat transfer for small ones and names.',
    includes: ['T-shirts', 'Hoodies', 'Uniforms', 'Caps', 'Screen printing', 'Heat transfer', 'Embroidery'],
    materials: ['Combed cotton and poly-cotton blanks', 'Plastisol and water-based screen inks', 'Heat-transfer vinyl', 'Embroidery thread'],
    turnaround: '3 to 7 working days',
    minimum: '10 pieces',
    productCategories: ['apparel'],
    faqs: [
      { question: 'Can you print different names on each shirt?', answer: 'Yes, with heat transfer. It’s common for teams and staff uniforms.' },
      { question: 'Do you supply the garments?', answer: 'Yes, in all common sizes and colours. You can also bring your own.' },
      { question: 'Screen print or heat transfer?', answer: 'Screen print for bigger runs and bold colours; heat transfer for small runs, names and photos. We’ll recommend one.' },
    ],
    image: img('tshirts-rack', 'A rack of t-shirts in every colour of the rainbow'),
  },
  {
    slug: 'corporate-gifts',
    name: 'Corporate gifts',
    summary: 'Branded gifts people actually keep: mugs, bottles, umbrellas and bags.',
    intro:
      'Good gifts get used every day, with your name on them. We source, brand and pack mugs, bottles, notebooks, umbrellas and bags, and can deliver them to every desk on your list.',
    includes: ['Mugs', 'Water bottles', 'Umbrellas', 'Gift bags', 'Notebooks', 'Gift boxes'],
    materials: ['Ceramic and enamel mugs', 'Steel bottles, printed or laser engraved', 'Kraft and laminated paper bags', 'Gift boxes and tissue'],
    turnaround: '5 to 10 working days',
    minimum: '10 pieces',
    productCategories: ['gifts'],
    faqs: [
      { question: 'Can you pack and deliver gift sets?', answer: 'Yes. We pack each set with a card and deliver to one address or to each recipient.' },
      { question: 'Printed or engraved?', answer: 'Printing gives full colour; laser engraving is permanent and looks premium on steel. We’ll show you samples.' },
      { question: 'Can I see a sample first?', answer: 'For orders over 100 pieces we make one sample for you to approve before the run.' },
    ],
    image: img('water-bottles', 'Three pastel metal water bottles on a white surface'),
  },
  {
    slug: 'stationery',
    name: 'Stationery and print',
    summary: 'Business cards, letterheads, brochures and booklets, sharp and on time.',
    intro:
      'Everyday print that makes a business look established: business cards, letterheads, envelopes, brochures, booklets and posters. Our studio can design them or prepare your artwork so it prints perfectly.',
    includes: ['Business cards', 'Letterheads', 'Envelopes', 'Brochures', 'Booklets', 'Posters', 'Logo design'],
    materials: ['300 to 400 gsm card', 'Uncoated, silk and gloss papers', 'Soft-touch and gloss laminate', 'Saddle-stitched and perfect binding'],
    turnaround: '2 to 5 working days',
    minimum: '10 pieces',
    productCategories: ['stationery', 'print'],
    faqs: [
      { question: 'Can you design my logo too?', answer: 'Yes. Our studio designs logos and stationery together so everything matches.' },
      { question: 'What file should I send?', answer: 'A print-ready PDF is best. If you only have a Word file or a photo, send it and our designers will prepare it.' },
      { question: 'Can I get a printed proof?', answer: 'Yes, for a small fee that’s taken off the order. Digital proofs are always free.' },
    ],
    image: img('business-cards', 'Two stacks of blank business cards'),
  },
  {
    slug: 'large-format',
    name: 'Large-format printing',
    summary: 'Banners, roll-ups and backdrops printed in-house on wide-format machines.',
    intro:
      'Roll-up banners, backdrops, stickers and canvas, printed in our own workshop on wide-format machines. Most jobs are ready in a day or two, so it’s the fastest way to be seen at your next event.',
    includes: ['Banner stands', 'Backdrops', 'Vinyl stickers', 'Canvas', 'Posters', 'Floor graphics'],
    materials: ['Frontlit flex banner', 'Self-adhesive vinyl, gloss or matte', 'Canvas and photo paper', 'Roll-up and X-banner stands'],
    turnaround: '1 to 3 working days',
    minimum: 'One piece',
    productCategories: ['display', 'print'],
    faqs: [
      { question: 'Can you print the same day?', answer: 'Often, yes, if your artwork is ready before noon. Ask us on WhatsApp.' },
      { question: 'What size can you print?', answer: 'Up to 3.2 m wide in one piece; bigger backdrops are joined invisibly.' },
      { question: 'Do banner stands come with a bag?', answer: 'Yes, every roll-up comes with its stand and a carry bag.' },
    ],
    image: img('print-wide-format', 'A wide-format printer feeding out a long pink banner'),
  },
];
