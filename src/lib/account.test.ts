import { describe, expect, it } from 'vitest';
import { coerceAddress, coerceBrandKit, isCode, maskPhone, MAX_KIT_LOGOS } from './account';

describe('account rules', () => {
  it('checks codes and masks phones', () => {
    expect(isCode(' 123456 ')).toBe(true);
    expect(isCode('12345')).toBe(false);
    expect(isCode('12345a')).toBe(false);
    expect(maskPhone('+254722530301')).toBe('07•• ••• 301');
  });

  it('cleans a brand kit and says what to fix', () => {
    const { kit, errors } = coerceBrandKit({
      colours: [' #D7000F ', '485 C', ''],
      typography: 'named',
      fonts: '',
      logos: [{ name: 'logo.svg', size: 2048, type: 'image/svg+xml' }, { name: '' }, 'nope', ...Array.from({ length: 9 }, (_, i) => ({ name: `l${i}.png` }))],
      notes: 'x'.repeat(2000),
    });
    expect(kit.colours).toEqual(['#D7000F', '485 C']);
    expect(errors.fonts).toMatch(/Name your fonts/);
    expect(kit.logos).toHaveLength(MAX_KIT_LOGOS);
    expect(kit.logos[0]).toEqual({ name: 'logo.svg', size: 2048, type: 'image/svg+xml' });
    expect(kit.notes).toHaveLength(1000);
    expect(coerceBrandKit({ colours: ['<script>'] }).errors.colours).toMatch(/isn’t a colour/);
    expect(coerceBrandKit(null).kit.typography).toBe('from-logo');
  });

  it('cleans a saved address', () => {
    expect(coerceAddress({ label: 'Office', address: 'Loita Street, Nairobi', zone: 'cbd' })).toEqual({
      address: { id: undefined, label: 'Office', address: 'Loita Street, Nairobi', zone: 'cbd' },
      error: null,
    });
    expect(coerceAddress({ address: 'x', zone: 'moon' }).address.zone).toBe('cbd');
    expect(coerceAddress({ address: 'x' }).error).toMatch(/building/);
  });
});
