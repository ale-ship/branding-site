import type { Metadata } from 'next';
import Link from 'next/link';
import { QuoteCta } from '@/components/home/QuoteCta';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/ui/Reveal';
import { ProjectCard } from '@/components/work/ProjectCard';
import { WorkFiltersBar } from '@/components/work/WorkFilters';
import { api } from '@/lib/api';
import { filterProjects, hasFilters, parseWorkFilters, workFacets } from '@/lib/work';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const description =
  'Signage, vehicle wraps, apparel, gifts and print that Noorcom Branding has designed, printed and installed for businesses across Kenya.';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filters = parseWorkFilters(await searchParams, await api.listProjects());
  return {
    title: 'Work',
    description,
    alternates: { canonical: '/work' },
    // Filtered views repeat the archive; only the full archive is indexed.
    robots: hasFilters(filters) ? { index: false, follow: true } : undefined,
  };
}

export default async function WorkPage({ searchParams }: Props) {
  const [params, projects, services] = await Promise.all([searchParams, api.listProjects(), api.listServices()]);
  const filters = parseWorkFilters(params, projects);
  const results = filterProjects(projects, filters);
  const facets = workFacets(projects, services, filters);

  return (
    <>
      <PageHeader
        eyebrow="Work"
        title="Made in Nairobi, seen everywhere"
        intro="Every job here was designed, printed and installed by our own team. Filter by what you need to see the work closest to yours."
      >
        <WorkFiltersBar facets={facets} filters={filters} />
      </PageHeader>

      <Container className="pb-20 sm:pb-32">
        <p aria-live="polite" className="mb-8 border-b border-border pb-4 text-sm text-muted">
          {results.length === 1 ? '1 project' : `${results.length} projects`}
        </p>
        {results.length ? (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
            {results.map((project, i) => (
              <Reveal as="li" key={project.slug} delay={(i % 3) * 80}>
                <ProjectCard project={project} size="grid" as="h2" priority={i < 3} />
              </Reveal>
            ))}
          </ul>
        ) : (
          <div className="bg-paper px-6 py-16 text-center sm:py-24">
            <h2 className="text-3xl font-bold">Nothing matches those filters yet</h2>
            <p className="mx-auto mt-3 max-w-md text-body">Try fewer filters, or tell us about your job: we’ve probably made something like it.</p>
            <Link
              href="/work"
              className="mt-6 inline-flex min-h-11 items-center font-semibold text-heading underline decoration-accent decoration-2 underline-offset-4"
            >
              Show all work
            </Link>
          </div>
        )}
      </Container>

      <QuoteCta />
    </>
  );
}
