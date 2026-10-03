import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mockApi } from './mock';
import type { Photo } from './types';

const publicDir = path.resolve(__dirname, '..', '..', '..', 'public');
const onDisk = (photo: Photo) => existsSync(path.join(publicDir, photo.src));

describe('mock data', () => {
  it('has unique slugs everywhere', async () => {
    for (const items of [await mockApi.listServices(), await mockApi.listProjects(), await mockApi.listProducts()]) {
      const slugs = items.map((item) => item.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('prices products per piece with a minimum order', async () => {
    for (const product of await mockApi.listProducts()) {
      expect(Number.isInteger(product.pricePerPiece)).toBe(true);
      expect(product.pricePerPiece).toBeGreaterThan(0);
      expect(product.minQuantity).toBeGreaterThanOrEqual(1);
    }
  });

  it('only names services that exist', async () => {
    const known = new Set((await mockApi.listServices()).map((s) => s.slug));
    for (const project of await mockApi.listProjects()) {
      expect(project.services.length).toBeGreaterThan(0);
      for (const slug of project.services) expect(known.has(slug)).toBe(true);
    }
  });

  it('points every photo at a file in public/ with alt text', async () => {
    const photos: Photo[] = [
      ...(await mockApi.listServices()).map((s) => s.image),
      ...(await mockApi.listProjects()).flatMap((p) => [
        p.cover,
        ...p.applications,
        ...p.behindTheScenes,
        ...(p.beforeAfter ? [p.beforeAfter.before, p.beforeAfter.after] : []),
      ]),
      ...(await mockApi.listProducts()).map((p) => p.image),
    ];
    for (const photo of photos) {
      expect(photo.alt.length, photo.src).toBeGreaterThan(0);
      expect(onDisk(photo), photo.src).toBe(true);
    }
  });

  it('finds a project by slug', async () => {
    const [first] = await mockApi.listProjects();
    expect((await mockApi.getProject(first!.slug))?.title).toBe(first!.title);
    expect(await mockApi.getProject('no-such-project')).toBeNull();
  });

  it('lists projects newest first', async () => {
    const years = (await mockApi.listProjects()).map((p) => p.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it('filters and limits', async () => {
    const featured = await mockApi.listProducts({ featured: true, limit: 2 });
    expect(featured).toHaveLength(2);
    expect(featured.every((p) => p.featured)).toBe(true);
  });

  it('returns copies, not the stored data', async () => {
    const [first] = await mockApi.listProducts();
    first!.name = 'changed';
    const [again] = await mockApi.listProducts();
    expect(again!.name).not.toBe('changed');
  });
});
