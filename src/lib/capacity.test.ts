import { describe, expect, it } from 'vitest';
import { orderProducts } from './api/data/order-catalogue';
import type { PriceRequest } from './api/order-types';
import { allocate, book, capacityFinish, loadOn, machineFor, type CapacityCalendar } from './capacity';
import { estimatePrice } from './pricing';

const tees = orderProducts.find((p) => p.slug === 't-shirt-printing')!;
const mugs = orderProducts.find((p) => p.slug === 'mug-branding')!;
const survey = orderProducts.find((p) => p.mechanism === 'B')!;

describe('the capacity calendar', () => {
  it('picks the machine from the product and the brief', () => {
    expect(machineFor(tees, { method: 'screen' })).toBe('screen-press');
    expect(machineFor(tees, { method: 'embroidery' })).toBe('embroidery');
    expect(machineFor(tees, { method: 'heat' })).toBe('dtf');
    expect(machineFor(mugs, {})).toBe('sublimation');
    expect(machineFor(survey, {})).toBeNull();
  });

  it('fills free capacity day by day, skipping Sundays and holidays', () => {
    // DTF does 150 a day. Friday 16 Oct has 100 booked; Saturday is free; Sunday and Mashujaa Day (Tue 20) are skipped.
    const cal: CapacityCalendar = { dtf: { '2026-10-16': 100 } };
    expect(allocate(250, 'dtf', '2026-10-16', cal)).toEqual({ finish: '2026-10-19', days: { '2026-10-16': 50, '2026-10-17': 150, '2026-10-19': 50 } });
    expect(allocate(100, 'dtf', '2026-10-18', {}).finish).toBe('2026-10-19');
  });

  it('books and releases reservations', () => {
    const cal: CapacityCalendar = {};
    book(cal, 'dtf', { '2026-10-16': 75 });
    expect(loadOn(cal, 'dtf', '2026-10-16')).toBe(0.5);
    book(cal, 'dtf', { '2026-10-16': 75 }, -1);
    expect(cal.dtf).toEqual({});
  });

  it('switches off a rush the workshop can’t meet and moves standard dates', () => {
    const request: PriceRequest = { product: tees.slug, quantity: 300, brief: { method: 'heat', printColours: 1 }, needsDesign: false, urgency: 'rush', handover: { method: 'pickup' } };
    const free = estimatePrice(tees, request, '2026-10-06', {});
    // A full week of DTF work booked: 300 pieces can't be done fast.
    const busy: CapacityCalendar = { dtf: Object.fromEntries(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map((d) => [d, 150])) };
    const finish = capacityFinish(tees, 300, request.brief, '2026-10-06', busy);
    expect(finish).toBe('2026-10-19');
    const full = estimatePrice(tees, request, '2026-10-06', busy);
    for (const code of ['express', 'rush'] as const) {
      const tier = full.tiers.find((t) => t.code === code)!;
      if (free.tiers.find((t) => t.code === code)!.available) expect(tier).toMatchObject({ available: false, reason: expect.stringMatching(/Fully booked/) });
    }
    expect(full.urgency.code).toBe('standard');
    expect(full.readyBy! >= finish!).toBe(true);
    expect(full.tiers.find((t) => t.code === 'standard')!.readyBy! >= finish!).toBe(true);
  });
});
