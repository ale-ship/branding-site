import Image from 'next/image';
import Link from 'next/link';
import type { Project, Service } from '@/lib/api';
import { Container } from '../ui/Container';
import { Swatches } from '../ui/PrintMarks';
import { Reveal } from '../ui/Reveal';
import { SectionHeading } from './SectionHeading';

/**
 * An editorial grid of projects (BP&O, The Dieline): uneven column spans and a staggered
 * second column, each card a big image with a short line of metadata.
 */
const layout = [
  'lg:col-span-7',
  'lg:col-span-5 lg:mt-32',
  'lg:col-span-5',
  'lg:col-span-7 lg:mt-24',
  'lg:col-span-6',
  'lg:col-span-6 lg:mt-20',
];

export function SelectedWork({ projects, services }: { projects: Project[]; services: Service[] }) {
  const serviceName = new Map(services.map((s) => [s.slug, s.name]));
  return (
    <section aria-labelledby="work-title" className="py-20 sm:py-32">
      <Container>
        <SectionHeading
          id="work-title"
          eyebrow="Selected work"
          title="Jobs we’re proud to put our name on"
          link={{ href: '/work', label: 'All work' }}
        />
        <ul className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-y-20">
          {projects.map((project, i) => (
            <Reveal as="li" key={project.slug} delay={(i % 2) * 120} className={layout[i % layout.length]}>
              <Link href={`/work/${project.slug}`} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden bg-panel">
                  <Image
                    src={project.cover.src}
                    alt={project.cover.alt}
                    fill
                    sizes="(min-width: 1024px) 50vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
                  />
                  {project.sample && (
                    <span className="absolute top-3 left-3 bg-bg px-2.5 py-1 text-[0.7rem] font-semibold tracking-[0.14em] text-heading uppercase">
                      Sample
                    </span>
                  )}
                </div>
                <div className="mt-5 flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm text-muted">
                      {project.client} · {project.industry} · {project.year}
                    </p>
                    <h3 className="mt-2 text-2xl leading-tight font-bold transition-colors group-hover:text-accent-ink sm:text-[1.75rem]">
                      {project.title}
                    </h3>
                    <p className="mt-3 flex flex-wrap gap-2">
                      {project.services.map((slug) => (
                        <span key={slug} className="border border-border px-2.5 py-1 text-xs font-medium text-body">
                          {serviceName.get(slug)}
                        </span>
                      ))}
                    </p>
                  </div>
                  <Swatches colours={project.palette} label={`Colours used: ${project.palette.join(', ')}`} />
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
