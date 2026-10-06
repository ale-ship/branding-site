import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger, maskPhone, maskPhones } from '../../src/lib/logger.js';

function capture() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(JSON.parse(chunk.toString()));
      done();
    },
  });
  return { lines, logger: createLogger({ env: 'development', level: 'info', stream }) };
}

describe('logger', () => {
  it('masks Kenyan phone numbers in every form', () => {
    expect(maskPhone('+254722530301')).toBe('+2547*****301');
    expect(maskPhones('call 0722530301 or 254722530301, order NB-123456')).toBe('call 0722***301 or 2547*****301, order NB-123456');
  });

  it('masks phones in messages and fields, and redacts secrets', () => {
    const { lines, logger } = capture();
    logger.info({ customer: { phone: '+254722530301' }, body: { token: 'abc', code: '123456' } }, 'paid by 0722530301');
    expect(lines[0].msg).toBe('paid by 0722***301');
    expect(lines[0].customer.phone).toBe('+2547*****301');
    expect(lines[0].body).toEqual({ token: '[redacted]', code: '[redacted]' });
  });

  it('is silent in tests', () => {
    expect(createLogger({ env: 'test' }).level).toBe('silent');
  });
});
