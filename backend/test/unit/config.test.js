import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/config.js';

describe('config', () => {
  it('has safe defaults for development', () => {
    const c = parseConfig({});
    expect(c).toMatchObject({ env: 'development', host: '127.0.0.1', port: 4300, databaseUrl: undefined, redisUrl: undefined });
    expect(c.integrations).toEqual({ absa: 'fake', daraja: 'fake', whatsapp: 'fake', storage: 'fake', email: 'fake' });
    expect(c.absa).toEqual({ secret: 'dev-callback-secret', paybill: '303030', fakeDelayMs: 6000 });
    expect(c.mail.smtp).toBeNull();
  });

  it('treats empty values as unset', () => {
    expect(parseConfig({ DATABASE_URL: '', REDIS_URL: '', LOG_LEVEL: '' })).toMatchObject({ databaseUrl: undefined, redisUrl: undefined, logLevel: undefined });
  });

  it('names a bad value', () => {
    expect(() => parseConfig({ PORT: 'eighty' })).toThrow(/PORT/);
    expect(() => parseConfig({ ABSA_MODE: 'maybe' })).toThrow(/ABSA_MODE/);
  });

  it('needs Postgres and Redis in production', () => {
    expect(() => parseConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL: required in production; REDIS_URL: required in production/);
    const prod = { NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/nb', REDIS_URL: 'redis://nb:p@127.0.0.1:6379' };
    expect(() => parseConfig(prod)).toThrow(/ABSA_CALLBACK_SECRET/);
    expect(parseConfig({ ...prod, ABSA_CALLBACK_SECRET: 'x'.repeat(32) }).env).toBe('production');
  });

  it('refuses live mode for clients that are not built yet', () => {
    expect(() => parseConfig({ ABSA_MODE: 'live' })).toThrow(/ABSA_MODE: live is not built yet/);
    expect(() => parseConfig({ WHATSAPP_MODE: 'live' })).toThrow(/WHATSAPP_MODE/);
  });

  it('refuses fakes behind the live site’s address', () => {
    expect(() => parseConfig({ PUBLIC_URL: 'https://noorcombranding.co.ke' })).toThrow(/PUBLIC_URL is the live site/);
    expect(parseConfig({ PUBLIC_URL: 'https://staging.noorcombranding.co.ke/' }).publicUrl).toBe('https://staging.noorcombranding.co.ke');
  });

  it('sends email through SMTP when a host is set', () => {
    const c = parseConfig({ SMTP_HOST: 'mail.example.com', SMTP_USER: 'u', SMTP_PASS: 'p' });
    expect(c.integrations.email).toBe('live');
    expect(c.mail.smtp).toEqual({ host: 'mail.example.com', port: 587, user: 'u', pass: 'p' });
  });
});
