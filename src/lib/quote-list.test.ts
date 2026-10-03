import { describe, expect, it } from 'vitest';
import {
  addItem,
  defaultOptions,
  describeOptions,
  estimateTotal,
  itemKey,
  parseList,
  QUOTE_LIST_MAX,
  removeItem,
  setQuantity,
  totalPieces,
} from './quote-list';

const cards = { slug: 'business-cards', quantity: 100, options: { Finish: 'Matte', Sides: 'Both sides' } };
const mugs = { slug: 'mug-branding', quantity: 50, options: { Mug: 'White ceramic' } };

describe('itemKey', () => {
  it('ignores option order', () => {
    expect(itemKey({ slug: 'x', options: { a: '1', b: '2' } })).toBe(itemKey({ slug: 'x', options: { b: '2', a: '1' } }));
  });
});

describe('addItem', () => {
  it('appends new lines', () => {
    expect(addItem([cards], mugs)).toEqual([cards, mugs]);
  });

  it('sets the quantity of a matching line instead of duplicating it', () => {
    expect(addItem([cards, mugs], { ...cards, quantity: 250 })).toEqual([{ ...cards, quantity: 250 }, mugs]);
  });

  it('keeps different options as separate lines', () => {
    expect(addItem([cards], { ...cards, options: { Finish: 'Gloss', Sides: 'Both sides' } })).toHaveLength(2);
  });

  it('stops at the cap', () => {
    const full = Array.from({ length: QUOTE_LIST_MAX }, (_, i) => ({ slug: `p${i}`, quantity: 1, options: {} }));
    expect(addItem(full, mugs)).toHaveLength(QUOTE_LIST_MAX);
  });
});

describe('setQuantity and removeItem', () => {
  it('change only the matching line', () => {
    const list = [cards, mugs];
    expect(setQuantity(list, itemKey(mugs), 80)[1]!.quantity).toBe(80);
    expect(removeItem(list, itemKey(cards))).toEqual([mugs]);
  });
});

describe('parseList', () => {
  it('reads a stored list', () => {
    expect(parseList(JSON.stringify([cards, mugs]))).toEqual([cards, mugs]);
  });

  it('drops anything malformed', () => {
    expect(parseList(null)).toEqual([]);
    expect(parseList('not json')).toEqual([]);
    expect(parseList('{"slug":"x"}')).toEqual([]);
    const raw = JSON.stringify([
      { slug: 'ok', quantity: 2, options: { a: 'b', n: 5 } },
      { slug: '', quantity: 1 },
      { slug: 'neg', quantity: -1 },
      { slug: 'frac', quantity: 1.5 },
      'junk',
    ]);
    expect(parseList(raw)).toEqual([{ slug: 'ok', quantity: 2, options: { a: 'b' } }]);
  });
});

describe('totals and labels', () => {
  const catalogue = [
    { slug: 'business-cards', pricePerPiece: 18 },
    { slug: 'mug-branding', pricePerPiece: 450 },
  ];

  it('estimates and counts', () => {
    expect(estimateTotal([cards, mugs], catalogue)).toBe(100 * 18 + 50 * 450);
    expect(estimateTotal([{ slug: 'gone', quantity: 5, options: {} }], catalogue)).toBe(0);
    expect(totalPieces([cards, mugs])).toBe(150);
  });

  it('picks the first value of each option and describes options', () => {
    expect(defaultOptions({ options: [{ name: 'Finish', values: ['Matte', 'Gloss'] }] })).toEqual({ Finish: 'Matte' });
    expect(describeOptions({ Finish: 'Matte', Sides: 'Both sides' })).toBe('Finish: Matte · Sides: Both sides');
  });
});
