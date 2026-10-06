import { describe, expect, it } from 'vitest';
import { changeRequestError, checklistComplete, coerceChecklist, coercePins, MAX_PIN_TEXT, MAX_PINS } from './proof';

describe('proof rules', () => {
  it('counts only explicit ticks on the checklist', () => {
    const all = { spelling: true, colours: true, size: true, quantity: true, colourVariance: true };
    expect(checklistComplete(coerceChecklist(all))).toBe(true);
    expect(checklistComplete(coerceChecklist({ ...all, colourVariance: 'true' }))).toBe(false);
    expect(checklistComplete(coerceChecklist(null))).toBe(false);
  });

  it('cleans pins from the browser', () => {
    expect(coercePins('nope')).toEqual([]);
    expect(
      coercePins([
        { x: 1.4, y: -2, text: '  Bigger  ' },
        { x: 0.5, text: 'half a pin' },
        { x: 0.2, y: 0.2, text: '   ' },
        { x: '0.25', y: '0.75', text: 'from strings' },
        null,
      ]),
    ).toEqual([
      { x: 1, y: 0, text: 'Bigger' },
      { x: null, y: null, text: 'half a pin' },
      { x: 0.25, y: 0.75, text: 'from strings' },
    ]);
    expect(coercePins(Array.from({ length: 40 }, () => ({ x: 0, y: 0, text: 'a' })))).toHaveLength(MAX_PINS);
    expect(coercePins([{ x: 0, y: 0, text: 'a'.repeat(999) }])[0]!.text).toHaveLength(MAX_PIN_TEXT);
  });

  it('needs a note or a pin to ask for changes', () => {
    expect(changeRequestError('', [])).toMatch(/what to change/);
    expect(changeRequestError('Bigger logo', [])).toBeNull();
    expect(changeRequestError('', [{ x: null, y: null, text: 'x' }])).toBeNull();
  });
});
