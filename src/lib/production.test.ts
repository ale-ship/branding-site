import { describe, expect, it } from 'vitest';
import type { Delivery } from './api/order-types';
import { deliverablePieces, needsSample, partialDeliveryError, productionEta, productionRate } from './production';

const log = (at: string, pieces: number) => ({ at, pieces, note: '' });
const delivery = (pieces: number, status: Delivery['status'] = 'delivered'): Delivery => ({
  id: 'D',
  pieces,
  partial: true,
  status,
  rider: null,
  riderPhone: null,
  waybill: null,
  recipient: null,
  requestedAt: '',
  deliveredAt: null,
});

describe('production', () => {
  it('asks for a sample from 200 pieces, quantity runs only', () => {
    expect(needsSample('A', 199)).toBe(false);
    expect(needsSample('A', 200)).toBe(true);
    expect(needsSample('B', 500)).toBe(false);
  });

  it('uses the capacity until the logs span two working days, then the real rate', () => {
    expect(productionRate([], 150)).toBe(150);
    expect(productionRate([log('2026-10-05T08:00:00Z', 40), log('2026-10-05T12:00:00Z', 40)], 150)).toBe(150);
    expect(productionRate([log('2026-10-05T08:00:00Z', 80), log('2026-10-06T08:00:00Z', 40)], 150)).toBe(60);
    expect(productionRate([], null)).toBeNull();
  });

  it('works out the finish date in working days and flags it at risk', () => {
    // Monday 5 Oct, 300 left at 150 a day: today and Tuesday.
    expect(productionEta(0, 300, [], 150, '2026-10-05', '2026-10-13')).toEqual({ left: 300, perDay: 150, finishBy: '2026-10-06', atRisk: false });
    // On a Sunday, the work starts Monday.
    expect(productionEta(0, 150, [], 150, '2026-10-04', null).finishBy).toBe('2026-10-05');
    expect(productionEta(0, 3000, [], 150, '2026-10-05', '2026-10-13').atRisk).toBe(true);
    expect(productionEta(300, 300, [], 150, '2026-10-05', null)).toMatchObject({ left: 0, finishBy: '2026-10-05' });
    expect(productionEta(0, 300, [], null, '2026-10-05', null).finishBy).toBeNull();
  });

  it('lets an early delivery take only finished pieces not already sent', () => {
    expect(deliverablePieces(120, [delivery(50)])).toBe(70);
    expect(partialDeliveryError(50, 0, 300, [])).toMatch(/No finished/);
    expect(partialDeliveryError(80, 120, 300, [delivery(50)])).toMatch(/Only 70/);
    expect(partialDeliveryError(70, 120, 300, [delivery(50)])).toBeNull();
    expect(partialDeliveryError(10, 120, 300, [delivery(50, 'out')])).toMatch(/already on its way/);
    expect(partialDeliveryError(0, 120, 300, [])).toMatch(/how many/);
    expect(partialDeliveryError(100, 300, 300, [])).toMatch(/one delivery/);
  });
});
