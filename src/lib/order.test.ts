import { describe, expect, it } from 'vitest';
import { orderProducts } from './api/data/order-catalogue';
import {
  coerceOrderDraft,
  describeBrief,
  draftBriefFrom,
  emptyOrderDraft,
  stepOfField,
  toOrderInput,
  toPriceRequest,
  validateBrief,
  validateOrderDraft,
  type OrderDraft,
} from './order';

const TODAY = '2026-10-05';
const get = (slug: string) => orderProducts.find((p) => p.slug === slug)!;
const tees = get('t-shirt-printing');
const survey = get('outdoor-branding-job');
const poster = get('poster-design');

function filledTees(): OrderDraft {
  const d = emptyOrderDraft(tees);
  d.quantity = '100';
  d.brief.sizes = { S: '20', M: '30', L: '30', XL: '20', XXL: '' };
  d.brief.printColours = '2';
  d.name = 'Amina Otieno';
  d.phone = '0722 530 301';
  d.email = 'amina@example.co.ke';
  d.agree = true;
  return d;
}

describe('emptyOrderDraft', () => {
  it('starts at the minimum, with sensible defaults', () => {
    const d = emptyOrderDraft(tees);
    expect(d.quantity).toBe('10');
    expect(d.brief.garmentColour).toBe('White');
    expect(d.brief.positions).toEqual(['front']);
    expect(d.handover).toBe('pickup');
    expect(emptyOrderDraft(survey).handover).toBe('install');
    expect(emptyOrderDraft(poster).handover).toBe('digital');
  });
});

describe('validateOrderDraft', () => {
  it('accepts a complete order', () => {
    expect(validateOrderDraft(filledTees(), tees, undefined, TODAY)).toEqual({});
  });

  it('enforces the minimum quantity', () => {
    const d = { ...filledTees(), quantity: '9' };
    expect(validateOrderDraft(d, tees, 'what', TODAY).quantity).toBe('The minimum is 10 pieces.');
  });

  it('checks that sizes add up to the quantity', () => {
    const d = filledTees();
    d.quantity = '120';
    expect(validateOrderDraft(d, tees, 'what', TODAY)['brief.sizes']).toBe('Sizes: these add up to 100, but you’re ordering 120.');
  });

  it('only checks the step asked for', () => {
    const d = emptyOrderDraft(tees);
    expect(Object.keys(validateOrderDraft(d, tees, 'you', TODAY)).sort()).toEqual(['agree', 'email', 'name', 'phone']);
  });

  it('checks colours, links and print-ready artwork', () => {
    const d = filledTees();
    d.common.colours = ['#FF0000', 'Pantone 485 C', '#GGG'];
    d.common.inspirationLinks = ['pinterest.com/x'];
    d.common.artwork = 'print-ready';
    const e = validateOrderDraft(d, tees, 'brief', TODAY);
    expect(e['common.colours']).toMatch(/#GGG/);
    expect(e['common.inspirationLinks']).toBe('Links must start with https://');
    expect(e['common.assets']).toMatch(/print-ready artwork/);
  });

  it('asks where to deliver', () => {
    const d = { ...filledTees(), handover: 'delivery' as const, address: '' };
    expect(validateOrderDraft(d, tees, 'when', TODAY).address).toBeDefined();
  });

  it('maps every field to its step', () => {
    expect(stepOfField('quantity')).toBe('what');
    expect(stepOfField('brief.sizes')).toBe('what');
    expect(stepOfField('common.colours')).toBe('brief');
    expect(stepOfField('address')).toBe('when');
    expect(stepOfField('phone')).toBe('you');
  });
});

describe('validateBrief', () => {
  it('checks survey dates and dimensions on a site job', () => {
    const brief = { siteAddress: 'Loita Street', signType: 'shop-front', size: { widthCm: '300', heightCm: 'x' }, lit: false, permit: false, surveyDates: ['2026-10-05', ''] };
    const e = validateBrief(survey.brief, brief, 1, TODAY);
    expect(e.size).toMatch(/whole centimetres/);
    expect(e.surveyDates).toBe('Preferred survey dates: choose 2 dates.');
    const later = validateBrief(survey.brief, { ...brief, size: { widthCm: '300', heightCm: '100' }, surveyDates: ['2026-10-05', '2026-10-07'] }, 1, TODAY);
    expect(later.surveyDates).toBe('Preferred survey dates: from the next working day on.');
  });
});

describe('conversions', () => {
  it('turns the draft into numbers for pricing, tolerating half-typed input', () => {
    const d = { ...filledTees(), quantity: '1' };
    expect(toPriceRequest(d, tees).quantity).toBe(10);
    const r = toPriceRequest(filledTees(), tees);
    expect(r.brief.sizes).toEqual({ S: 20, M: 30, L: 30, XL: 20, XXL: 0 });
    expect(r.brief.printColours).toBe(2);
    expect(r.needsDesign).toBe(true);
  });

  it('builds the order with a normalised phone; B and C fix their handover', () => {
    expect(toOrderInput(filledTees(), tees).customer.phone).toBe('+254722530301');
    expect(toPriceRequest(emptyOrderDraft(poster), poster).handover).toEqual({ method: 'digital' });
    const s = emptyOrderDraft(survey);
    s.brief.siteAddress = 'Chuka Elimu Plaza';
    expect(toPriceRequest(s, survey).handover).toEqual({ method: 'install', address: 'Chuka Elimu Plaza' });
  });
});

describe('coerceOrderDraft', () => {
  it('keeps only what the product’s brief knows, with the right types', () => {
    const d = coerceOrderDraft(
      { quantity: 100, brief: { garmentColour: 'Black', positions: 'front', sizes: { S: 5, Z: '9' }, hack: 'x' }, handover: 'install', urgency: 'warp', agree: 'yes' },
      tees,
    );
    expect(d.quantity).toBe('');
    expect(d.brief.garmentColour).toBe('Black');
    expect(d.brief.positions).toEqual([]);
    expect(d.brief.sizes).toEqual({ S: '', M: '', L: '', XL: '', XXL: '' });
    expect('hack' in d.brief).toBe(false);
    expect(d.handover).toBe('pickup');
    expect(d.urgency).toBe('standard');
    expect(d.agree).toBe(false);
  });

  it('fixes the handover by mechanism whatever was sent', () => {
    expect(coerceOrderDraft({ handover: 'delivery' }, survey).handover).toBe('install');
    expect(coerceOrderDraft({ handover: 'pickup' }, poster).handover).toBe('digital');
  });
});

describe('describeBrief', () => {
  it('turns answers into readable rows, skipping empty ones', () => {
    const rows = describeBrief(tees.brief, toPriceRequest(filledTees(), tees).brief);
    expect(rows).toEqual([
      { label: 'T-shirt colour', value: 'White' },
      { label: 'Sizes', value: 'S 20, M 30, L 30, XL 20' },
      { label: 'Print positions', value: 'Front' },
      { label: 'Printing method', value: 'Screen print' },
      { label: 'Colours in the design', value: '2' },
    ]);
  });
});

describe('draftBriefFrom', () => {
  it('turns saved answers back into the form’s text, and round-trips', () => {
    const tees = orderProducts.find((p) => p.slug === 't-shirt-printing')!;
    const answers = { garmentColour: 'White', sizes: { S: 10, M: 0, L: 40, XL: 0, XXL: 0 }, positions: ['front'], method: 'heat', printColours: 1, stray: 'x' };
    const brief = draftBriefFrom(tees, answers);
    expect(brief.sizes).toEqual({ S: '10', M: '', L: '40', XL: '', XXL: '' });
    expect(brief.printColours).toBe('1');
    expect(brief).not.toHaveProperty('stray');
    const draft: OrderDraft = { ...emptyOrderDraft(tees), quantity: '50', brief };
    expect(toPriceRequest(draft, tees).brief).toMatchObject({ sizes: { S: 10, L: 40 }, printColours: 1 });
  });
});
