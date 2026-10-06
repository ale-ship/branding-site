import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/config.js';

describe('config', () => {
  it('has safe defaults for development', () => {
    const c = parseConfig({});
    expect(c).toMatchObject({ env: 'development', host: '127.0.0.1', port: 4300, databaseUrl: undefined, redisUrl: undefined });
    expect(c.integrations).toEqual({ absa: 'fake', daraja: 'fake', whatsapp: 'fake', storage: 'fake' });
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
    expect(parseConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/nb', REDIS_URL: 'redis://nb:p@127.0.0.1:6379' }).env).toBe('production');
  });
});
