import { describe, expect, it } from 'vitest';
import { areaSqm, buildSiteQuote, earliestInstall, installDateError, itemPrice, siteItemsError } from './site-quote';

describe('the site quote builder', () => {
  it('prices by area with a minimum per item', () => {
    expect(areaSqm({ widthCm: 420, heightCm: 260 })).toBe(10.92);
    // 10.92 m² of wallpaper at 2,400.
    expect(itemPrice({ label: 'Wall', material: 'wallpaper', widthCm: 420, heightCm: 260, quantity: 1 })).toBe(26208);
    // A small decal is charged the minimum, per piece.
    expect(itemPrice({ label: 'Decal', material: 'vinyl', widthCm: 60, heightCm: 60, quantity: 2 })).toBe(5000);
  });

  it('adds fitting and extras, and asks half as the deposit', () => {
    const q = buildSiteQuote(
      [{ label: 'Wall', material: 'wallpaper', widthCm: 420, heightCm: 260, quantity: 1 }],
      [{ label: 'County permit', amount: 12000 }],
      '2026-10-06',
    );
    expect(q.lines.map((l) => l.label)).toEqual(['Wall', 'Installation', 'County permit']);
    expect(q.lines[1]!.amount).toBe(3822);
    expect(q.total).toBe(26208 + 3822 + 12000);
    expect(q.deposit).toBe(Math.round(q.total / 2));
    expect(q.validUntil).toBe('2026-10-20');
  });

  it('refuses items it can’t price', () => {
    expect(siteItemsError([])).toMatch(/at least one/);
    expect(siteItemsError([{ label: 'Wall', material: 'vinyl', widthCm: 0, heightCm: 10, quantity: 1 }])).toMatch(/size/);
    expect(siteItemsError([{ label: 'Wall', material: 'vinyl', widthCm: 10, heightCm: 10, quantity: 1.5 }])).toMatch(/quantity/);
    expect(() => buildSiteQuote([], [], '2026-10-06')).toThrow();
  });

  it('books installation two working days ahead, on working days only', () => {
    // Tuesday 6 Oct: the earliest is Thursday 8 Oct.
    expect(earliestInstall('2026-10-06')).toBe('2026-10-08');
    expect(installDateError('2026-10-07', '2026-10-06')).toMatch(/two working days/);
    expect(installDateError('2026-10-08', '2026-10-06')).toBeNull();
    expect(installDateError('2026-10-11', '2026-10-06')).toMatch(/Monday to Saturday/);
    expect(installDateError('2026-10-20', '2026-10-06')).toMatch(/Monday to Saturday/); // Mashujaa Day
    expect(installDateError('2027-06-01', '2026-10-06')).toMatch(/four months/);
    expect(installDateError('soon', '2026-10-06')).toMatch(/Choose a date/);
  });
});
