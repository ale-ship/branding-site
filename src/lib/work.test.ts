import { describe, expect, it } from 'vitest';
import { mockApi } from './api/mock';
import {
  filterProjects,
  hasFilters,
  industrySlug,
  nextProject,
  parseWorkFilters,
  workFacets,
  workHref,
} from './work';

const projects = await mockApi.listProjects();
const services = await mockApi.listServices();

describe('industrySlug', () => {
  it('makes URL-safe slugs', () => {
    expect(industrySlug('Food and drink')).toBe('food-and-drink');
    expect(industrySlug('  Professional services ')).toBe('professional-services');
  });
});

describe('parseWorkFilters', () => {
  it('keeps known values', () => {
    expect(parseWorkFilters({ service: 'apparel', industry: 'events', year: '2025' }, projects)).toEqual({
      service: 'apparel',
      industry: 'events',
      year: 2025,
    });
  });

  it('drops unknown or malformed values', () => {
    expect(parseWorkFilters({ service: 'nope', industry: 'mining', year: 'abc' }, projects)).toEqual({});
    expect(parseWorkFilters({ year: '1999' }, projects)).toEqual({});
  });

  it('takes the first of repeated params', () => {
    expect(parseWorkFilters({ service: ['apparel', 'stationery'] }, projects)).toEqual({ service: 'apparel' });
  });
});

describe('filterProjects', () => {
  it('returns everything without filters', () => {
    expect(filterProjects(projects, {})).toHaveLength(projects.length);
  });

  it('combines filters with AND', () => {
    const result = filterProjects(projects, { service: 'indoor-branding', year: 2024 });
    expect(result.length).toBeGreaterThan(0);
    for (const p of result) {
      expect(p.services).toContain('indoor-branding');
      expect(p.year).toBe(2024);
    }
  });
});

describe('workFacets', () => {
  it('counts each option against the other filters', () => {
    const facets = workFacets(projects, services, { year: 2025 });
    const apparel = facets.services.find((f) => f.value === 'apparel');
    expect(apparel?.count).toBe(filterProjects(projects, { year: 2025, service: 'apparel' }).length);
    // The year facet ignores the year filter itself, so every year still shows its full count.
    const total = facets.years.reduce((sum, f) => sum + f.count, 0);
    expect(total).toBe(projects.length);
  });

  it('lists years newest first and only services that have work', () => {
    const facets = workFacets(projects, services, {});
    const years = facets.years.map((f) => f.value);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    for (const f of facets.services) expect(f.count).toBeGreaterThan(0);
  });
});

describe('workHref', () => {
  it('builds stable URLs', () => {
    expect(workHref({})).toBe('/work');
    expect(workHref({ year: 2025, service: 'apparel' })).toBe('/work?service=apparel&year=2025');
  });

  it('reports whether any filter is set', () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ industry: 'retail' })).toBe(true);
  });
});

describe('nextProject', () => {
  it('wraps round to the first project', () => {
    const last = projects[projects.length - 1]!;
    expect(nextProject(projects, last.slug)?.slug).toBe(projects[0]!.slug);
    expect(nextProject(projects, 'missing')).toBeNull();
  });
});
