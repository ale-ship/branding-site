import { describe, expect, it } from 'vitest';
import { localPhone, trackIndex } from './order-status';
import { numberToWords, shillingsInWords } from './words';

describe('numberToWords', () => {
  it.each([
    [0, 'Zero'],
    [7, 'Seven'],
    [19, 'Nineteen'],
    [45, 'Forty-Five'],
    [100, 'One Hundred'],
    [118, 'One Hundred and Eighteen'],
    [1250, 'One Thousand Two Hundred and Fifty'],
    [2005, 'Two Thousand and Five'],
    [90000, 'Ninety Thousand'],
    [1_000_001, 'One Million and One'],
    [12_345_678, 'Twelve Million Three Hundred and Forty-Five Thousand Six Hundred and Seventy-Eight'],
  ])('%i', (n, words) => {
    expect(numberToWords(n)).toBe(words);
  });

  it('writes shillings as on the invoice template', () => {
    expect(shillingsInWords(90000)).toBe('Kenya Shillings Ninety Thousand Only.');
  });
});

describe('order status helpers', () => {
  it('places statuses on each track, side statuses off it', () => {
    expect(trackIndex('A', 'awaiting_payment')).toBe(0);
    expect(trackIndex('A', 'in_production')).toBe(4);
    expect(trackIndex('B', 'ready')).toBe(4);
    expect(trackIndex('C', 'out_for_handover')).toBe(3);
    expect(trackIndex('A', 'expired')).toBe(-1);
  });

  it('shows phones the local way', () => {
    expect(localPhone('+254722530301')).toBe('0722 530 301');
    expect(localPhone('something')).toBe('something');
  });
});
