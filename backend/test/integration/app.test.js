import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { AppError, errorHandler } from '../../src/lib/errors.js';
import { createLogger } from '../../src/lib/logger.js';
import { requestContext } from '../../src/middleware/requestId.js';

const config = parseConfig({ NODE_ENV: 'test', BUILD_ID: 'test-build' });
const logger = createLogger({ env: 'test' });

const upPool = { query: async () => ({ rows: [{ ok: 1 }] }) };
const downPool = { query: async () => Promise.reject(new Error('ECONNREFUSED')) };

/** A Redis stand-in: answers PING and runs the rate limiter's script with an in-memory counter. */
function fakeRedis({ ready = true } = {}) {
  const counts = new Map();
  return {
    status: ready ? 'ready' : 'reconnecting',
    ping: async () => 'PONG',
    eval: async (_script, _n, bucket, windowSec) => {
      if (!ready) throw new Error('Connection is closed');
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      return [counts.get(bucket), Number(windowSec)];
    },
  };
}

describe('GET /api/health', () => {
  it('is ok when Postgres and Redis answer', async () => {
    const app = createApp(config, { logger, pool: upPool, redis: fakeRedis() });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', build: 'test-build', db: 'up', redis: 'up', integrations: { absa: 'fake', daraja: 'fake', whatsapp: 'fake', storage: 'fake', email: 'fake' } });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('is degraded, with 503, when either is down or missing', async () => {
    for (const [pool, redis] of [
      [downPool, fakeRedis()],
      [upPool, fakeRedis({ ready: false })],
      [null, null],
    ]) {
      const res = await request(createApp(config, { logger, pool, redis })).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
    }
  });

  it('keeps a sane request id from the caller', async () => {
    const res = await request(createApp(config, { logger, pool: upPool, redis: fakeRedis() })).get('/api/health').set('X-Request-Id', 'site-req-12345678');
    expect(res.headers['x-request-id']).toBe('site-req-12345678');
  });
});

describe('the API around the modules', () => {
  it('answers unknown endpoints with the error shape', async () => {
    const res = await request(createApp(config, { logger, pool: upPool, redis: fakeRedis() })).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found', message: 'No such endpoint.' });
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('limits requests per IP, with Retry-After', async () => {
    const app = createApp(config, { logger, pool: upPool, redis: fakeRedis(), limits: { api: { limit: 2, windowSec: 60 } } });
    await request(app).get('/api/nope');
    await request(app).get('/api/nope');
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limited');
    expect(res.headers['retry-after']).toBe('60');
  });

  it('lets requests through when Redis is down (fails open)', async () => {
    const res = await request(createApp(config, { logger, pool: upPool, redis: fakeRedis({ ready: false }) })).get('/api/nope');
    expect(res.status).toBe(404);
  });

  it('turns bad JSON, app errors, the rules’ errors and crashes into safe answers', async () => {
    // The same error handler and body parser as the app, around a route that raises each kind of error.
    const errors = { app: new AppError(409, 'conflict', 'Already paid.'), order: new OrderError('invalid_state', 'Nothing is due.'), crash: new Error('SELECT * FROM secrets failed') };
    const app = express()
      .use(requestContext(logger))
      .use(express.json())
      .post('/api/boom/:kind', (req) => {
        throw errors[req.params.kind];
      })
      .use(errorHandler);
    const bad = await request(app).post('/api/boom/app').set('Content-Type', 'application/json').send('{"oops"');
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('invalid');
    expect((await request(app).post('/api/boom/app')).body).toEqual({ error: 'conflict', message: 'Already paid.' });
    const order = await request(app).post('/api/boom/order');
    expect(order.status).toBe(409);
    expect(order.body).toEqual({ error: 'invalid_state', message: 'Nothing is due.' });
    const crash = await request(app).post('/api/boom/crash');
    expect(crash.status).toBe(500);
    expect(JSON.stringify(crash.body)).not.toMatch(/secrets/);
  });
});
