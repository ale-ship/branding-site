import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';

/**
 * POST /revalidate: the API asks the site to drop cached content after staff change it in the back
 * office (docs/BACKEND_RUNBOOK.md, "The website editor"), so the next visit shows the change. Outside
 * /api/ on purpose: on the VPS nginx sends /api/ to the API. Only the API, which knows
 * REVALIDATE_SECRET, may ask; it calls the site on this machine, not through nginx.
 */
const TAGS = ['content', 'catalogue'];

function secret(): string {
  return process.env.REVALIDATE_SECRET ?? (process.env.NODE_ENV === 'production' ? '' : 'dev-revalidate-secret');
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: Request) {
  const expected = secret();
  if (!expected || !same(request.headers.get('x-revalidate-secret') ?? '', expected)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t): t is string => typeof t === 'string' && TAGS.includes(t)) : [];
  // Gone at once, not served stale: staff expect to see their change on the next visit.
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: tags });
}
