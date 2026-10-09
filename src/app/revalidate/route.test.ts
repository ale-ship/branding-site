import { afterEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));
import { POST } from './route';

const ask = (secret: string, tags: unknown) =>
  POST(new Request('http://localhost/revalidate', { method: 'POST', headers: { 'x-revalidate-secret': secret }, body: JSON.stringify({ tags }) }));

afterEach(() => revalidateTag.mockClear());

describe('POST /revalidate', () => {
  it('drops the named content at once for the API', async () => {
    const res = await ask('dev-revalidate-secret', ['content', 'catalogue', 'everything']);
    expect(await res.json()).toEqual({ revalidated: ['content', 'catalogue'] });
    expect(revalidateTag.mock.calls).toEqual([
      ['content', { expire: 0 }],
      ['catalogue', { expire: 0 }],
    ]);
  });

  it('does nothing for anyone without the secret', async () => {
    expect((await ask('guess', ['content'])).status).toBe(403);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
