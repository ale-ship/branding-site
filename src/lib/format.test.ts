import { describe, expect, it } from 'vitest';
import { formatKes, pad2 } from './format';

describe('formatKes', () => {
  it('formats whole shillings with separators', () => {
    expect(formatKes(18)).toBe('KES 18');
    expect(formatKes(3500)).toBe('KES 3,500');
    expect(formatKes(1234567)).toBe('KES 1,234,567');
  });

  it('rounds to whole shillings', () => {
    expect(formatKes(17.6)).toBe('KES 18');
  });
});

describe('pad2', () => {
  it('pads single digits', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(12)).toBe('12');
  });
});
