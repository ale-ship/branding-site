import { describe, expect, it } from 'vitest';
import type { Order } from './api/order-types';
import { orderWhatsAppText } from './order-message';

const order = {
  ref: 'NB-303008',
  mechanism: 'A',
  product: { slug: 't-shirt-printing', name: 'T-shirt printing', category: 'apparel' },
  quantity: 120,
  needsDesign: true,
  common: {
    colours: ['#D71920'],
    typography: 'from-logo',
    fonts: '',
    assets: [{ name: 'logo.pdf', size: 1, type: 'application/pdf' }],
    inspiration: [],
    inspirationLinks: [],
    text: 'Acme Logistics',
    styles: ['Bold'],
    artwork: 'need-design',
    notes: 'Logo on the left chest.',
  },
  estimate: { urgency: { code: 'standard', label: 'Standard', multiplier: 1, amount: 0 }, readyBy: '2026-10-30', total: 92000 },
  total: 92000,
  dueNow: 46000,
  duePurpose: 'deposit',
  customer: { name: 'Ahmed Yare', company: 'F&A', phone: '+254722552552', email: 'ahmed@fatco.co.ke' },
} as unknown as Order;

describe('orderWhatsAppText', () => {
  it('puts the whole order, the price and how to pay in the message', () => {
    const text = orderWhatsAppText(order, {
      briefRows: [
        { label: 'Garment colour', value: 'Black' },
        { label: 'Sizes', value: 'S 20, M 40, L 40, XL 20' },
      ],
      handover: 'Collect from Chuka Elimu Plaza, 1st Floor, Loita Street',
      link: 'https://noorcombranding.co.ke/order/NB-303008?t=abc',
    });
    expect(text.split('\n')).toEqual([
      'Hello Noorcom Branding, I’ve placed order NB-303008 on your website.',
      '',
      '*T-shirt printing × 120 pieces*',
      'Garment colour: Black',
      'Sizes: S 20, M 40, L 40, XL 20',
      '',
      'Design: please design it for me',
      'Files: logo.pdf',
      'Text on it: Acme Logistics',
      'Colours: #D71920',
      'Style: Bold',
      'Notes: Logo on the left chest.',
      '',
      expect.stringMatching(/^Deadline: Standard, ready by .*30.*Oct/),
      'Handover: Collect from Chuka Elimu Plaza, 1st Floor, Loita Street',
      '',
      'Total: KES 92,000',
      'To pay now: KES 46,000 (deposit)',
      'Paybill 303030, account 2055268420#NB303008',
      '',
      'Ahmed Yare, F&A · +254722552552 · ahmed@fatco.co.ke',
      'Order page: https://noorcombranding.co.ke/order/NB-303008?t=abc',
    ]);
  });

  it('leaves out what is empty, and the payment lines once nothing is due', () => {
    const paid = { ...order, dueNow: 0, duePurpose: null, common: { ...order.common, assets: [], text: '', colours: [], styles: [], notes: '' }, needsDesign: false } as Order;
    const text = orderWhatsAppText(paid, { briefRows: [], handover: 'Delivery', link: 'x' });
    expect(text).toContain('Design: I have print-ready artwork');
    expect(text).not.toMatch(/Files:|Text on it|Colours|To pay now|Paybill/);
  });
});
