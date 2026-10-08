// @ts-check

/**
 * @typedef {import('../contract/order-types.js').BriefField} BriefField
 * @typedef {import('../contract/order-types.js').OrderCategory} OrderCategory
 * @typedef {import('../contract/order-types.js').OrderProduct} OrderProduct
 */

/** @param {string} name @param {string} alt */
const img = (name, alt) => ({ src: `/images/placeholder/${name}.jpg`, alt });

/**
 * What can be ordered online (docs/ORDER_WORKFLOW_SPEC.md). Each product's `mechanism` decides the
 * form, the price, the tracker and the handover; its `brief` is the category-specific questions.
 *
 * TODO(business): every price tier, fee, lead time and option here is a proposal for Noorcom to
 * confirm. Products that are also in the shop keep the shop's price and minimum as their first tier
 * (checked in mock.test.ts).
 *
 * The site reads it through the mock (src/lib/api/data/order-catalogue.ts re-exports it); the backend
 * seeds the database from it (backend/src/db/seeds/01-catalogue.js, docs/BACKEND_RUNBOOK.md step B1).
 * Once staff edit prices in the back office (B4), the database is the record and this is the seed.
 */

/** @type {OrderCategory[]} */
export const orderCategories = [
  { slug: 'apparel', name: 'Apparel', mechanism: 'A', summary: 'T-shirts, hoodies, caps and uniforms.', image: img('tshirts-rack', 'A rack of t-shirts in every colour'), service: 'apparel' },
  { slug: 'corporate-gifts', name: 'Corporate gifts', mechanism: 'A', summary: 'Mugs, bottles, umbrellas, notebooks and bags.', image: img('water-bottles', 'Three pastel metal water bottles'), service: 'corporate-gifts' },
  { slug: 'stationery', name: 'Stationery', mechanism: 'A', summary: 'Business cards and letterheads.', image: img('business-cards-stack', 'Stacks of business cards'), service: 'stationery' },
  { slug: 'books', name: 'Books and booklets', mechanism: 'A', summary: 'Company profiles, catalogues and reports.', image: img('booklet', 'A hardcover booklet'), service: 'stationery' },
  { slug: 'print', name: 'Posters, flyers and brochures', mechanism: 'A', summary: 'From A5 flyers to A0 posters.', image: img('print-samples', 'Printed brochures and design books'), service: 'stationery' },
  { slug: 'large-format', name: 'Large format', mechanism: 'A', summary: 'Roll-up banners and banners for events.', image: img('banner-outdoor', 'A tall printed banner on a wall'), service: 'large-format' },
  { slug: 'indoor-branding', name: 'Indoor branding', mechanism: 'B', summary: 'Offices, receptions and shops: we survey, design and install.', image: img('wall-mural', 'An office lounge with a wall mural'), service: 'indoor-branding' },
  { slug: 'outdoor-branding', name: 'Outdoor branding', mechanism: 'B', summary: 'Shop fronts, pylons, light boxes and billboards.', image: img('billboard', 'A roadside billboard'), service: 'outdoor-branding' },
  { slug: 'vehicle-branding', name: 'Vehicle branding', mechanism: 'B', summary: 'Full wraps, partial wraps and door decals.', image: img('van-wrap', 'A van with a full graphic wrap'), service: 'vehicle-branding' },
  { slug: 'design', name: 'Design only', mechanism: 'C', summary: 'Logos, posters, flyers, menus and social media artwork, as files.', image: img('print-samples', 'Design books and printed samples') },
];

// ── Shared brief fields ─────────────────────────────────────────────────────

const garmentColours = ['White', 'Black', 'Navy', 'Grey', 'Red', 'Royal blue', 'Bottle green', 'Maroon'];
/** @type {BriefField} */
const sizes = {
  id: 'sizes',
  label: 'Sizes',
  kind: 'sizes',
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  required: true,
  help: 'How many of each size. They must add up to your quantity.',
};
/** @type {BriefField} */
const printPositions = {
  id: 'positions',
  label: 'Print positions',
  kind: 'multiselect',
  required: true,
  options: [
    { value: 'front', label: 'Front' },
    { value: 'back', label: 'Back', unitDelta: 150 },
    { value: 'chest', label: 'Left chest', unitDelta: 80 },
    { value: 'sleeve', label: 'Sleeve', unitDelta: 100 },
  ],
};
/** @type {BriefField} */
const apparelMethod = {
  id: 'method',
  label: 'Printing method',
  kind: 'select',
  required: true,
  help: 'Not sure? Screen print for 100+ pieces, heat transfer for small runs and names.',
  options: [
    { value: 'screen', label: 'Screen print', fixedDelta: 1500 },
    { value: 'heat', label: 'Heat transfer' },
    { value: 'embroidery', label: 'Embroidery', unitDelta: 200 },
  ],
};
/** @type {BriefField} */
const printColours = { id: 'printColours', label: 'Colours in the design', kind: 'number', min: 1, max: 8, required: true };
/** @type {BriefField} */
const giftPackaging = { id: 'packaging', label: 'Gift packaging', kind: 'yesno', yesUnitDelta: 80, help: 'A gift box or bag for each piece.' };
/** @type {BriefField} */
const surveyDates = { id: 'surveyDates', label: 'Preferred survey dates', kind: 'dates', count: 2, required: true, help: 'Two dates that suit you; we confirm one.' };
/** @type {BriefField} */
const siteAddress = { id: 'siteAddress', label: 'Site address', kind: 'text', required: true, placeholder: 'Building, street, area, town', maxLength: 200 };

const stageNames = ['Survey', 'Firm quote accepted', 'Design approved', 'Materials printed', 'Installation scheduled', 'Installed', 'Signed off'];

// ── Products ────────────────────────────────────────────────────────────────

/** @type {OrderProduct[]} */
export const orderProducts = [
  // A. Quantity runs
  {
    slug: 't-shirt-printing',
    shopSlug: 't-shirt-printing',
    name: 'T-shirt printing',
    category: 'apparel',
    mechanism: 'A',
    summary: 'Cotton t-shirts printed for staff, teams and events.',
    image: img('tshirts-folded', 'Three folded t-shirts'),
    priceTiers: [
      { minQty: 10, unitPrice: 650 },
      { minQty: 100, unitPrice: 600 },
      { minQty: 300, unitPrice: 550 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 2000,
    standardLeadDays: 5,
    rushAllowed: true,
    rushMaxQty: 100,
    brief: [
      { id: 'garmentColour', label: 'T-shirt colour', kind: 'select', required: true, options: garmentColours.map((c) => ({ value: c, label: c })) },
      sizes,
      printPositions,
      apparelMethod,
      printColours,
    ],
  },
  {
    slug: 'hoodie-branding',
    shopSlug: 'hoodie-branding',
    name: 'Hoodie branding',
    category: 'apparel',
    mechanism: 'A',
    summary: 'Heavy hoodies, printed or embroidered.',
    image: img('hoodie', 'A plain white hoodie'),
    priceTiers: [
      { minQty: 10, unitPrice: 2500 },
      { minQty: 100, unitPrice: 2350 },
      { minQty: 300, unitPrice: 2200 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 2000,
    standardLeadDays: 7,
    rushAllowed: false,
    brief: [
      { id: 'garmentColour', label: 'Hoodie colour', kind: 'select', required: true, options: ['Black', 'Navy', 'Grey', 'White'].map((c) => ({ value: c, label: c })) },
      sizes,
      printPositions,
      apparelMethod,
      printColours,
    ],
  },
  {
    slug: 'mug-branding',
    shopSlug: 'mug-branding',
    name: 'Mug branding',
    category: 'corporate-gifts',
    mechanism: 'A',
    summary: 'Ceramic mugs printed to survive the dishwasher.',
    image: img('mug', 'A white mug with a printed logo'),
    priceTiers: [
      { minQty: 10, unitPrice: 450 },
      { minQty: 200, unitPrice: 420 },
      { minQty: 500, unitPrice: 390 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 1500,
    standardLeadDays: 4,
    rushAllowed: true,
    rushMaxQty: 100,
    brief: [
      {
        id: 'variant',
        label: 'Mug',
        kind: 'select',
        required: true,
        options: [
          { value: 'white', label: 'White ceramic' },
          { value: 'magic', label: 'Colour-change', unitDelta: 100 },
          { value: 'enamel', label: 'Enamel', unitDelta: 80 },
        ],
      },
      {
        id: 'printArea',
        label: 'Print area',
        kind: 'select',
        required: true,
        options: [
          { value: 'one-side', label: 'One side' },
          { value: 'wrap', label: 'All the way round', unitDelta: 50 },
        ],
      },
      giftPackaging,
    ],
  },
  {
    slug: 'water-bottle-branding',
    shopSlug: 'water-bottle-branding',
    name: 'Water bottle branding',
    category: 'corporate-gifts',
    mechanism: 'A',
    summary: 'Steel bottles printed or laser engraved.',
    image: img('water-bottles', 'Three pastel metal water bottles'),
    priceTiers: [
      { minQty: 10, unitPrice: 800 },
      { minQty: 200, unitPrice: 750 },
      { minQty: 500, unitPrice: 700 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 1500,
    standardLeadDays: 5,
    rushAllowed: false,
    brief: [
      { id: 'colour', label: 'Bottle colour', kind: 'select', required: true, options: ['White', 'Black', 'Silver', 'Blue'].map((c) => ({ value: c, label: c })) },
      {
        id: 'method',
        label: 'Branding',
        kind: 'select',
        required: true,
        options: [
          { value: 'print', label: 'Printed in colour' },
          { value: 'engrave', label: 'Laser engraved', unitDelta: 100 },
        ],
      },
      giftPackaging,
    ],
  },
  {
    slug: 'umbrella-branding',
    shopSlug: 'umbrella-branding',
    name: 'Umbrella branding',
    category: 'corporate-gifts',
    mechanism: 'A',
    summary: 'Large umbrellas with your logo on the panels you choose.',
    image: img('umbrellas', 'Colourful open umbrellas'),
    priceTiers: [
      { minQty: 10, unitPrice: 1500 },
      { minQty: 200, unitPrice: 1400 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 1500,
    standardLeadDays: 7,
    rushAllowed: false,
    brief: [
      { id: 'size', label: 'Size', kind: 'select', required: true, options: [{ value: 'golf', label: 'Golf (30 inch)' }, { value: 'standard', label: 'Standard (23 inch)' }] },
      { id: 'panels', label: 'Printed panels', kind: 'number', min: 1, max: 8, required: true, help: 'Most umbrellas have 8 panels.' },
    ],
  },
  {
    slug: 'a4-notebooks',
    shopSlug: 'a4-notebooks',
    name: 'A4 notebooks',
    category: 'corporate-gifts',
    mechanism: 'A',
    summary: 'Spiral notebooks with your design on the cover.',
    image: img('notebook', 'A spiral notebook'),
    priceTiers: [
      { minQty: 10, unitPrice: 1200 },
      { minQty: 200, unitPrice: 1100 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 1500,
    standardLeadDays: 5,
    rushAllowed: false,
    brief: [{ id: 'pages', label: 'Pages', kind: 'select', required: true, options: ['Ruled', 'Plain', 'Dotted'].map((c) => ({ value: c.toLowerCase(), label: c })) }],
  },
  {
    slug: 'branded-gift-bags',
    shopSlug: 'branded-gift-bags',
    name: 'Branded gift bags',
    category: 'corporate-gifts',
    mechanism: 'A',
    summary: 'Paper bags with rope handles and your logo.',
    image: img('kraft-bag', 'A brown paper gift bag'),
    priceTiers: [
      { minQty: 10, unitPrice: 430 },
      { minQty: 300, unitPrice: 390 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 1500,
    standardLeadDays: 5,
    rushAllowed: false,
    brief: [{ id: 'size', label: 'Size', kind: 'select', required: true, options: ['Small', 'Medium', 'Large'].map((c) => ({ value: c.toLowerCase(), label: c })) }],
  },
  {
    slug: 'business-cards',
    shopSlug: 'business-cards',
    name: 'Business cards',
    category: 'stationery',
    mechanism: 'A',
    summary: 'Full colour on heavy card.',
    image: img('business-cards-stack', 'Stacks of business cards'),
    priceTiers: [
      { minQty: 10, unitPrice: 18 },
      { minQty: 500, unitPrice: 15 },
      { minQty: 1000, unitPrice: 12 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 1500,
    standardLeadDays: 2,
    rushAllowed: true,
    rushMaxQty: 1000,
    brief: [
      {
        id: 'finish',
        label: 'Finish',
        kind: 'select',
        required: true,
        options: [
          { value: 'matte', label: 'Matte laminate' },
          { value: 'gloss', label: 'Gloss laminate' },
          { value: 'soft', label: 'Soft-touch', unitDelta: 3 },
          { value: 'spot-uv', label: 'Spot UV', unitDelta: 4 },
          { value: 'foil', label: 'Gold or silver foil', unitDelta: 8 },
        ],
      },
      { id: 'sides', label: 'Sides', kind: 'select', required: true, options: [{ value: 'double', label: 'Both sides' }, { value: 'single', label: 'One side' }] },
      { id: 'names', label: 'Number of names', kind: 'number', min: 1, max: 100, required: true, help: 'One design per person. List each name and their details below.' },
      { id: 'nameDetails', label: 'Names and details', kind: 'textarea', maxLength: 2000, placeholder: 'Name, title, phone, email: one person per line' },
    ],
  },
  {
    slug: 'booklet-printing',
    shopSlug: 'booklet-printing',
    name: 'Booklet printing',
    category: 'books',
    mechanism: 'A',
    summary: 'Company profiles, catalogues and reports, up to 24 pages.',
    image: img('booklet', 'A hardcover booklet'),
    priceTiers: [
      { minQty: 10, unitPrice: 700 },
      { minQty: 200, unitPrice: 620 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 5000,
    standardLeadDays: 6,
    rushAllowed: false,
    brief: [
      { id: 'pages', label: 'Page count', kind: 'number', min: 4, max: 24, required: true, help: 'Up to 24 pages at this price; ask us for more.' },
      { id: 'size', label: 'Page size', kind: 'select', required: true, options: [{ value: 'a4', label: 'A4' }, { value: 'a5', label: 'A5' }] },
      { id: 'cover', label: 'Cover', kind: 'select', required: true, options: [{ value: 'soft', label: 'Soft cover' }, { value: 'hard', label: 'Hard cover', unitDelta: 300 }] },
      {
        id: 'binding',
        label: 'Binding',
        kind: 'select',
        required: true,
        options: [
          { value: 'saddle', label: 'Saddle stitch' },
          { value: 'perfect', label: 'Perfect bound', unitDelta: 80 },
          { value: 'spiral', label: 'Spiral', unitDelta: 60 },
        ],
      },
      { id: 'inner', label: 'Inside pages', kind: 'select', required: true, options: [{ value: 'colour', label: 'Full colour' }, { value: 'bw', label: 'Black and white' }] },
    ],
  },
  {
    slug: 'a5-posters',
    shopSlug: 'a5-posters',
    name: 'Posters and flyers',
    category: 'print',
    mechanism: 'A',
    summary: 'Bright, full-colour flyers and posters.',
    image: img('print-samples', 'Printed samples on a table'),
    priceTiers: [
      { minQty: 10, unitPrice: 28 },
      { minQty: 500, unitPrice: 22 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 2000,
    standardLeadDays: 2,
    rushAllowed: true,
    rushMaxQty: 2000,
    brief: [
      {
        id: 'size',
        label: 'Size',
        kind: 'select',
        required: true,
        options: [
          { value: 'a5', label: 'A5' },
          { value: 'a4', label: 'A4', unitDelta: 20 },
          { value: 'a3', label: 'A3', unitDelta: 60 },
          { value: 'a2', label: 'A2', unitDelta: 250 },
          { value: 'a1', label: 'A1', unitDelta: 600 },
          { value: 'a0', label: 'A0', unitDelta: 1200 },
        ],
      },
      { id: 'paper', label: 'Paper', kind: 'select', required: true, options: [{ value: 'gloss', label: 'Gloss 150 gsm' }, { value: 'matte', label: 'Matte 170 gsm', unitDelta: 2 }] },
    ],
  },
  {
    slug: 'brochures',
    shopSlug: 'brochures',
    name: 'Brochures',
    category: 'print',
    mechanism: 'A',
    summary: 'Folded brochures for menus, price lists and company profiles.',
    image: img('brochure', 'A folded brochure'),
    priceTiers: [
      { minQty: 10, unitPrice: 50 },
      { minQty: 500, unitPrice: 40 },
    ],
    minQuantity: 10,
    setupFee: 0,
    designFee: 3000,
    standardLeadDays: 3,
    rushAllowed: true,
    rushMaxQty: 1000,
    brief: [{ id: 'fold', label: 'Fold', kind: 'select', required: true, options: ['Tri-fold', 'Bi-fold', 'Z-fold'].map((c) => ({ value: c.toLowerCase(), label: c })) }],
  },
  {
    slug: 'banner-stands',
    shopSlug: 'banner-stands',
    name: 'Banner stands',
    category: 'large-format',
    mechanism: 'A',
    summary: 'Roll-up banners with stand and carry bag.',
    image: img('banner-outdoor', 'A tall printed banner'),
    priceTiers: [{ minQty: 10, unitPrice: 3500 }],
    minQuantity: 10,
    setupFee: 0,
    designFee: 2500,
    standardLeadDays: 2,
    rushAllowed: true,
    rushMaxQty: 100,
    brief: [
      {
        id: 'stand',
        label: 'Stand',
        kind: 'select',
        required: true,
        options: [
          { value: 'economy', label: 'Economy roll-up' },
          { value: 'premium', label: 'Premium roll-up', unitDelta: 1500 },
          { value: 'x', label: 'X-banner', unitDelta: -500 },
        ],
      },
      { id: 'use', label: 'Where it will be used', kind: 'select', required: true, options: [{ value: 'indoor', label: 'Indoors' }, { value: 'outdoor', label: 'Outdoors' }] },
    ],
  },

  // B. Site installations
  {
    slug: 'indoor-branding-job',
    name: 'Indoor branding',
    category: 'indoor-branding',
    mechanism: 'B',
    summary: 'Murals, frosted glass, signs and wayfinding, surveyed and installed.',
    image: img('wall-mural', 'An office lounge with a wall mural'),
    surveyFee: 2500,
    stages: stageNames,
    standardLeadDays: 10,
    rushAllowed: false,
    brief: [
      siteAddress,
      { id: 'space', label: 'Type of space', kind: 'select', required: true, options: ['Reception', 'Office', 'Shop', 'Event'].map((c) => ({ value: c.toLowerCase(), label: c })) },
      { id: 'surfaces', label: 'Surfaces', kind: 'multiselect', required: true, options: ['Walls', 'Glass', 'Floor', 'Signs'].map((c) => ({ value: c.toLowerCase(), label: c })) },
      { id: 'area', label: 'Approximate area', kind: 'number', min: 1, max: 5000, unit: 'm²', help: 'A rough guess is fine; we measure at the survey.' },
      surveyDates,
    ],
  },
  {
    slug: 'outdoor-branding-job',
    name: 'Outdoor branding',
    category: 'outdoor-branding',
    mechanism: 'B',
    summary: 'Shop fronts, pylons, light boxes and billboards, surveyed and installed.',
    image: img('billboard', 'A roadside billboard'),
    surveyFee: 2500,
    stages: ['Survey', 'Firm quote accepted', 'County permit', 'Design approved', 'Materials printed', 'Installation scheduled', 'Installed', 'Signed off'],
    standardLeadDays: 14,
    rushAllowed: false,
    brief: [
      siteAddress,
      { id: 'signType', label: 'Sign type', kind: 'select', required: true, options: ['Shop front', 'Pylon', 'Light box', 'Billboard'].map((c) => ({ value: c.toLowerCase().replace(' ', '-'), label: c })) },
      { id: 'size', label: 'Approximate size', kind: 'dimensions', maxCm: 5000 },
      { id: 'lit', label: 'Lit at night', kind: 'yesno' },
      { id: 'permit', label: 'County permit already in place', kind: 'yesno', help: 'If not, we track getting one as a stage.' },
      surveyDates,
    ],
  },
  {
    slug: 'vehicle-branding-job',
    name: 'Vehicle branding',
    category: 'vehicle-branding',
    mechanism: 'B',
    summary: 'Full wraps, partial wraps and door decals, fitted in our workshop.',
    image: img('van-wrap', 'A van with a full graphic wrap'),
    surveyFee: 1500,
    stages: ['Survey', 'Firm quote accepted', 'Design approved', 'Materials printed', 'Installation scheduled', 'Installed', 'Signed off'],
    standardLeadDays: 5,
    rushAllowed: false,
    brief: [
      { id: 'vehicle', label: 'Make, model and year', kind: 'text', required: true, placeholder: 'e.g. Toyota Probox 2018', maxLength: 120 },
      { id: 'count', label: 'Number of vehicles', kind: 'number', min: 1, max: 200, required: true },
      { id: 'coverage', label: 'Coverage', kind: 'select', required: true, options: [{ value: 'full', label: 'Full wrap' }, { value: 'partial', label: 'Partial wrap' }, { value: 'decals', label: 'Door decals only' }] },
      { id: 'parked', label: 'Where the vehicles are parked', kind: 'text', maxLength: 200, help: 'For the survey and, if easier, the installation.' },
      surveyDates,
    ],
  },

  // C. Design only
  ...(
    /** @type {[string, string, string, number][]} */ ([
      ['poster-design', 'Poster design', 'A print-ready poster or flyer design.', 3500],
      ['logo-package', 'Logo package', 'A logo with colours, fonts and every file format you need.', 15000],
      ['flyer-design', 'Flyer design', 'A one- or two-sided flyer, ready to print.', 3000],
      ['social-media-pack', 'Social media pack', 'Ten matching posts in the right sizes.', 8000],
      ['menu-design', 'Menu design', 'A menu for print, screen or both.', 6000],
    ])
  ).map(
    /** @returns {OrderProduct} */
    ([slug, name, summary, price]) => ({
      slug,
      name,
      category: 'design',
      mechanism: 'C',
      summary,
      image: img('print-samples', 'Design books and printed samples'),
      packagePrice: price,
      revisionRounds: 2,
      standardLeadDays: slug === 'logo-package' ? 7 : 3,
      rushAllowed: slug !== 'logo-package',
      brief: [
        { id: 'format', label: 'Size or platform', kind: 'text', required: true, placeholder: 'e.g. A3 poster, Instagram post, A4 menu', maxLength: 120 },
        {
          id: 'concepts',
          label: 'First concepts',
          kind: 'select',
          required: true,
          options: [
            { value: '1', label: 'One concept' },
            { value: '2', label: 'Two concepts', fixedDelta: Math.round(price * 0.3) },
            { value: '3', label: 'Three concepts', fixedDelta: Math.round(price * 0.5) },
          ],
        },
        {
          id: 'files',
          label: 'Files you need',
          kind: 'multiselect',
          required: true,
          options: [
            { value: 'pdf', label: 'Print-ready PDF' },
            { value: 'png', label: 'PNG and JPG' },
            { value: 'source', label: 'Source files (AI, PSD)', fixedDelta: Math.round(price * 0.25) },
          ],
        },
      ],
    }),
  ),
];
