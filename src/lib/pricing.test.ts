import { describe, expect, it } from 'vitest';
import { orderProducts } from './api/data/order-catalogue';
import type { OrderProduct, PriceRequest } from './api/order-types';
import { addWorkingDays, formatDateShort, isWorkingDay } from './calendar';
import { briefCosts, dueAtOrder, estimatePrice, FULL_PAYMENT_BELOW, leadDaysFor, tierAvailability, unitPriceFor } from './pricing';

const TODAY = '2026-10-05'; // a Monday
const get = (slug: string) => orderProducts.find((p) => p.slug === slug)!;
const cards = get('business-cards');
const tees = get('t-shirt-printing');
const survey = get('indoor-branding-job');
const logo = get('logo-package');

const req = (product: OrderProduct, over: Partial<PriceRequest> = {}): PriceRequest => ({
  product: product.slug,
  quantity: product.mechanism === 'A' ? product.minQuantity : 1,
  brief: {},
  needsDesign: false,
  urgency: 'standard',
  handover: { method: 'pickup' },
  ...over,
});

describe('calendar', () => {
  it('skips Sundays and public holidays', () => {
    expect(isWorkingDay('2026-10-04')).toBe(false); // Sunday
    expect(isWorkingDay('2026-10-20')).toBe(false); // Mashujaa Day
    expect(isWorkingDay('2026-10-10')).toBe(false); // Utamaduni Day (a Saturday)
    expect(isWorkingDay('2026-10-09')).toBe(true);
    // Fri 9 Oct + 1 working day: Sat 10 is a holiday, Sun 11 is Sunday, so Mon 12.
    expect(addWorkingDays('2026-10-09', 1)).toBe('2026-10-12');
    expect(formatDateShort('2026-10-05')).toBe('05/10/2026');
  });
});

describe('unit prices and tiers', () => {
  it('drops the unit price at each quantity tier', () => {
    expect(unitPriceFor(cards.mechanism === 'A' ? cards.priceTiers : [], 50)).toBe(18);
    expect(unitPriceFor(cards.mechanism === 'A' ? cards.priceTiers : [], 499)).toBe(18);
    expect(unitPriceFor(cards.mechanism === 'A' ? cards.priceTiers : [], 500)).toBe(15);
    expect(unitPriceFor(cards.mechanism === 'A' ? cards.priceTiers : [], 5000)).toBe(12);
  });

  it('scales lead time by deadline tier', () => {
    expect(leadDaysFor('standard', 5)).toBe(5);
    expect(leadDaysFor('express', 5)).toBe(3);
    expect(leadDaysFor('economy', 5)).toBe(8);
    expect(leadDaysFor('rush', 5)).toBe(1);
  });

  it('offers rush only where allowed and within its quantity', () => {
    expect(tierAvailability(tees, 'rush', 100).available).toBe(true);
    expect(tierAvailability(tees, 'rush', 101)).toEqual({ available: false, reason: 'Up to 100 pieces' });
    expect(tierAvailability(get('hoodie-branding'), 'rush', 50).available).toBe(false);
    expect(tierAvailability(survey, 'express', 1).available).toBe(false);
  });
});

describe('estimatePrice (A: quantity run)', () => {
  it('prices 120 cards with a priced finish and design', () => {
    const e = estimatePrice(cards, req(cards, { quantity: 120, brief: { finish: 'spot-uv', sides: 'double', names: 2 }, needsDesign: true }), TODAY);
    // 120 × 18 + 120 × 4 (spot UV) + 1,500 design = 2,160 + 480 + 1,500
    expect(e.subtotal).toBe(4140);
    expect(e.total).toBe(4140);
    expect(e.dueNow).toEqual({ amount: 4140, label: 'Full payment', purpose: 'full' });
    expect(e.balanceLater).toBe(0);
  });

  it('takes a 50% deposit above the full-payment threshold', () => {
    const e = estimatePrice(tees, req(tees, { quantity: 100, brief: { method: 'heat', positions: ['front'] } }), TODAY);
    expect(e.total).toBe(60000);
    expect(e.total!).toBeGreaterThanOrEqual(FULL_PAYMENT_BELOW);
    expect(e.dueNow).toEqual({ amount: 30000, label: '50% deposit', purpose: 'deposit' });
    expect(e.balanceLater).toBe(30000);
  });

  it('applies the urgency multiplier, then adds delivery', () => {
    const e = estimatePrice(tees, req(tees, { quantity: 100, urgency: 'express', brief: { method: 'heat' }, handover: { method: 'delivery', zone: 'cbd', address: 'x' } }), TODAY);
    expect(e.urgency.amount).toBe(15000); // 25% of 60,000
    expect(e.handoverFee).toBe(300);
    expect(e.total).toBe(75300);
  });

  it('prices every tier for comparison, marking unavailable ones', () => {
    const e = estimatePrice(tees, req(tees, { quantity: 300, brief: { method: 'heat' } }), TODAY);
    const rush = e.tiers.find((t) => t.code === 'rush')!;
    expect(rush.available).toBe(false);
    expect(rush.total).toBeNull();
    const economy = e.tiers.find((t) => t.code === 'economy')!;
    expect(economy.total).toBeLessThan(e.total!);
    expect(economy.readyBy! > e.readyBy!).toBe(true);
  });

  it('falls back to standard when the chosen tier is not available', () => {
    expect(estimatePrice(tees, req(tees, { quantity: 300, urgency: 'rush' }), TODAY).urgency.code).toBe('standard');
  });

  it('counts the ready date from the proof, in working days', () => {
    // Mon 5 Oct: proof Tue 6, then 2 working days: Thu 8.
    expect(estimatePrice(cards, req(cards), TODAY).readyBy).toBe('2026-10-08');
  });

  it('tells the customer when the next tier would be cheaper', () => {
    const e = estimatePrice(cards, req(cards, { quantity: 450 }), TODAY);
    expect(e.notes[0]).toBe('From 500 pieces the price drops to KES 15 each.');
  });
});

describe('estimatePrice (B and C)', () => {
  it('charges a site job only the survey fee, with no total yet', () => {
    const e = estimatePrice(survey, req(survey), TODAY);
    expect(e.total).toBeNull();
    expect(e.dueNow.purpose).toBe('survey_fee');
    expect(e.dueNow.amount).toBe(2500);
    expect(e.readyBy).toBeNull();
  });

  it('charges a design package in full, with priced extras', () => {
    const e = estimatePrice(logo, req(logo, { brief: { concepts: '3', files: ['pdf', 'source'] }, handover: { method: 'digital' } }), TODAY);
    // 15,000 + 50% for 3 concepts + 25% for source files
    expect(e.total).toBe(15000 + 7500 + 3750);
    expect(e.dueNow.purpose).toBe('full');
  });
});

describe('helpers', () => {
  it('turns priced choices into lines', () => {
    // In the brief's order: print positions come before the method. Front is included in the price.
    expect(briefCosts(tees.brief, { method: 'screen', positions: ['front', 'back'] }, 100)).toEqual([
      { label: 'Print positions: Back', detail: 'KES 150 × 100', amount: 15000, quantity: 100, unitPrice: 150 },
      { label: 'Printing method: Screen print', detail: 'once per order', amount: 1500 },
    ]);
  });

  it('works out what is due at checkout', () => {
    expect(dueAtOrder(cards, 4000).purpose).toBe('full');
    expect(dueAtOrder(cards, 10001)).toEqual({ amount: 5001, label: '50% deposit', purpose: 'deposit' });
    expect(dueAtOrder(logo, 20000).purpose).toBe('full');
  });
});
