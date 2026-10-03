import { describe, expect, it } from 'vitest';
import {
  artworkProblem,
  coerceDraft,
  emptyDraft,
  formatBytes,
  nairobiToday,
  normaliseKenyanPhone,
  QUOTE_STEPS,
  toQuoteRequest,
  validateQuote,
  whatsappFollowUp,
  type QuoteDraft,
} from './quote';

const services = ['apparel', 'stationery'];
const TODAY = '2026-10-03';

const valid: QuoteDraft = {
  ...emptyDraft('apparel'),
  quantity: '120',
  details: 'Crew t-shirts, white, logo on the chest, sizes S to XXL.',
  name: 'Amina',
  phone: '0722 530 301',
};

describe('normaliseKenyanPhone', () => {
  it.each([
    ['0722530301', '+254722530301'],
    ['0722 530 301', '+254722530301'],
    ['+254 722-530-301', '+254722530301'],
    ['254722530301', '+254722530301'],
    ['722530301', '+254722530301'],
    ['0110 123 456', '+254110123456'],
    ['(0722) 530301', '+254722530301'],
  ])('%s -> %s', (input, expected) => {
    expect(normaliseKenyanPhone(input)).toBe(expected);
  });

  it.each(['', '0722', '07225303011', '0822530301', '+1 415 555 0100', 'call me'])('rejects %s', (input) => {
    expect(normaliseKenyanPhone(input)).toBeNull();
  });
});

describe('validateQuote', () => {
  it('accepts a complete request', () => {
    expect(validateQuote(valid, services, undefined, TODAY)).toEqual({});
  });

  it('only checks the fields asked for, so each step validates on its own', () => {
    const errors = validateQuote(emptyDraft(), services, QUOTE_STEPS[0].fields, TODAY);
    expect(Object.keys(errors).sort()).toEqual(['details', 'quantity', 'service']);
  });

  it('needs a known service and a whole quantity', () => {
    const errors = validateQuote({ ...valid, service: 'rockets', quantity: '1.5' }, services, undefined, TODAY);
    expect(errors.service).toBeDefined();
    expect(errors.quantity).toBe('Enter a whole number, like 100.');
  });

  it('refuses a deadline in the past but allows today or none', () => {
    expect(validateQuote({ ...valid, deadline: '2026-10-02' }, services, undefined, TODAY).deadline).toBeDefined();
    expect(validateQuote({ ...valid, deadline: TODAY }, services, undefined, TODAY).deadline).toBeUndefined();
    expect(validateQuote({ ...valid, deadline: '' }, services, undefined, TODAY).deadline).toBeUndefined();
  });

  it('asks where to deliver or install, but not when collecting', () => {
    expect(validateQuote({ ...valid, fulfilment: 'install' }, services, undefined, TODAY).location).toBe('Where should we install it?');
    expect(validateQuote({ ...valid, fulfilment: 'deliver' }, services, undefined, TODAY).location).toBe('Where should we deliver it?');
    expect(validateQuote({ ...valid, fulfilment: 'collect' }, services, undefined, TODAY).location).toBeUndefined();
  });

  it('makes email required only when it is the preferred channel', () => {
    expect(validateQuote({ ...valid, preferredContact: 'email' }, services, undefined, TODAY).email).toBeDefined();
    expect(validateQuote({ ...valid, email: 'not-an-email' }, services, undefined, TODAY).email).toBe('Check your email address.');
    expect(validateQuote({ ...valid, email: 'amina@example.co.ke' }, services, undefined, TODAY).email).toBeUndefined();
  });

  it('checks artwork files', () => {
    const big = { name: 'banner.pdf', size: 30 * 1024 * 1024, type: 'application/pdf' };
    expect(validateQuote({ ...valid, artwork: [big] }, services, undefined, TODAY).artwork).toMatch(/over 25 MB/);
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.png`, size: 10, type: 'image/png' }));
    expect(validateQuote({ ...valid, artwork: six }, services, undefined, TODAY).artwork).toBe('Attach up to 5 files.');
  });
});

describe('artworkProblem', () => {
  it('accepts print formats in any case and refuses others', () => {
    expect(artworkProblem({ name: 'Logo.AI', size: 100, type: '' })).toBeNull();
    expect(artworkProblem({ name: 'brief.docx', size: 100, type: '' })).toMatch(/use PDF/);
    expect(artworkProblem({ name: 'empty.pdf', size: 0, type: '' })).toMatch(/empty/);
  });
});

describe('coerceDraft', () => {
  it('rebuilds a clean draft from junk', () => {
    const draft = coerceDraft({ service: 42, fulfilment: 'teleport', preferredContact: 'pigeon', needsDesign: 'yes', artwork: 'x', extra: 1 });
    expect(draft).toEqual(emptyDraft());
  });

  it('keeps good values and caps lengths', () => {
    const draft = coerceDraft({ ...valid, name: 'x'.repeat(500), artwork: [{ name: 'a.pdf', size: 10, type: 'application/pdf', path: 'C:/' }] });
    expect(draft.service).toBe('apparel');
    expect(draft.name).toHaveLength(120);
    expect(draft.artwork).toEqual([{ name: 'a.pdf', size: 10, type: 'application/pdf' }]);
  });

  it('lets an over-long description through so validation can reject it', () => {
    const draft = coerceDraft({ ...valid, details: 'x'.repeat(5000) });
    expect(validateQuote(draft, services, undefined, TODAY).details).toMatch(/under 2000/);
  });
});

describe('toQuoteRequest', () => {
  it('trims, numbers and normalises', () => {
    const request = toQuoteRequest({ ...valid, name: '  Amina ', location: 'Westlands', fulfilment: 'collect' });
    expect(request).toMatchObject({ quantity: 120, name: 'Amina', phone: '+254722530301', location: '' });
  });
});

describe('helpers', () => {
  it('formats file sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('gives the Nairobi date, not UTC', () => {
    // 22:30 UTC on 2 Oct is 01:30 on 3 Oct in Nairobi (UTC+3).
    expect(nairobiToday(new Date('2026-10-02T22:30:00Z'))).toBe('2026-10-03');
  });

  it('builds a WhatsApp follow-up with the reference', () => {
    const href = whatsappFollowUp('NB-123456', 'https://wa.me/254722530301');
    expect(href.startsWith('https://wa.me/254722530301?text=')).toBe(true);
    expect(decodeURIComponent(href.split('text=')[1]!)).toContain('NB-123456');
  });
});
