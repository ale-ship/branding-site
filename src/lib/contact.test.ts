import { describe, expect, it } from 'vitest';
import { coerceContact, emptyContact, toContactMessage, validateContact } from './contact';

const valid = { name: 'Amina', phone: '0722 530 301', email: '', message: 'Do you print on canvas bags?' };

describe('validateContact', () => {
  it('accepts a message with a phone, or with an email', () => {
    expect(validateContact(valid)).toEqual({});
    expect(validateContact({ ...valid, phone: '', email: 'amina@example.co.ke' })).toEqual({});
  });

  it('needs a way to reply', () => {
    expect(validateContact({ ...valid, phone: '' }).phone).toMatch(/phone number or an email/);
  });

  it('checks each field', () => {
    const errors = validateContact({ name: 'A', phone: '123', email: 'nope', message: 'hi' });
    expect(Object.keys(errors).sort()).toEqual(['email', 'message', 'name', 'phone']);
  });

  it('refuses an over-long message', () => {
    expect(validateContact({ ...valid, message: 'x'.repeat(2001) }).message).toMatch(/under 2000/);
  });
});

describe('coerceContact and toContactMessage', () => {
  it('cleans untrusted input', () => {
    expect(coerceContact({ name: 5, extra: true })).toEqual(emptyContact());
    expect(coerceContact({ ...valid, name: 'x'.repeat(300) }).name).toHaveLength(120);
  });

  it('trims and normalises', () => {
    expect(toContactMessage({ ...valid, name: ' Amina ' })).toEqual({
      name: 'Amina',
      phone: '+254722530301',
      email: '',
      message: 'Do you print on canvas bags?',
    });
  });
});
