import type { Project, Service, ServiceSlug } from './api/types';

/**
 * The Work archive's filters. State lives only in the URL (?service=&industry=&year=), so a
 * filtered view can be shared and works without JavaScript. Unknown values are ignored.
 */
export type WorkFilters = { service?: ServiceSlug; industry?: string; year?: number };

export type Facet<T> = { value: T; label: string; count: number };

export type WorkFacets = {
  services: Facet<ServiceSlug>[];
  industries: Facet<string>[];
  years: Facet<number>[];
};

/** `Food and drink` -> `food-and-drink`. */
export function industrySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads filters from search params, keeping only values that exist in the projects. */
export function parseWorkFilters(params: RawParams, projects: Project[]): WorkFilters {
  const filters: WorkFilters = {};
  const service = first(params.service);
  if (service && projects.some((p) => p.services.includes(service as ServiceSlug))) {
    filters.service = service as ServiceSlug;
  }
  const industry = first(params.industry);
  if (industry && projects.some((p) => industrySlug(p.industry) === industry)) {
    filters.industry = industry;
  }
  const year = Number(first(params.year));
  if (Number.isInteger(year) && projects.some((p) => p.year === year)) {
    filters.year = year;
  }
  return filters;
}

export function filterProjects(projects: Project[], filters: WorkFilters): Project[] {
  return projects.filter(
    (p) =>
      (!filters.service || p.services.includes(filters.service)) &&
      (!filters.industry || industrySlug(p.industry) === filters.industry) &&
      (!filters.year || p.year === filters.year),
  );
}

/**
 * Options for each filter, counted against the projects matching the *other* filters, so a
 * count always says how many results a click gives. Services keep the services list's order;
 * industries are alphabetical; years newest first. Options with no projects at all are left out.
 */
export function workFacets(projects: Project[], services: Service[], filters: WorkFilters): WorkFacets {
  const without = (key: keyof WorkFilters) => filterProjects(projects, { ...filters, [key]: undefined });

  const forService = without('service');
  const serviceFacets = services
    .filter((s) => projects.some((p) => p.services.includes(s.slug)))
    .map((s) => ({ value: s.slug, label: s.name, count: forService.filter((p) => p.services.includes(s.slug)).length }));

  const forIndustry = without('industry');
  const industryNames = [...new Set(projects.map((p) => p.industry))].sort((a, b) => a.localeCompare(b));
  const industryFacets = industryNames.map((name) => ({
    value: industrySlug(name),
    label: name,
    count: forIndustry.filter((p) => p.industry === name).length,
  }));

  const forYear = without('year');
  const years = [...new Set(projects.map((p) => p.year))].sort((a, b) => b - a);
  const yearFacets = years.map((year) => ({
    value: year,
    label: String(year),
    count: forYear.filter((p) => p.year === year).length,
  }));

  return { services: serviceFacets, industries: industryFacets, years: yearFacets };
}

/** The archive URL for a set of filters, in a fixed parameter order. */
export function workHref(filters: WorkFilters): string {
  const params = new URLSearchParams();
  if (filters.service) params.set('service', filters.service);
  if (filters.industry) params.set('industry', filters.industry);
  if (filters.year) params.set('year', String(filters.year));
  const query = params.toString();
  return query ? `/work?${query}` : '/work';
}

export function hasFilters(filters: WorkFilters): boolean {
  return Boolean(filters.service || filters.industry || filters.year);
}

export const projectHref = (slug: string) => `/work/${slug}`;

/** The project after this one in the list, wrapping round to the first. */
export function nextProject(projects: Project[], slug: string): Project | null {
  const i = projects.findIndex((p) => p.slug === slug);
  if (i === -1 || projects.length < 2) return null;
  return projects[(i + 1) % projects.length] ?? null;
}
