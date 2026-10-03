import Image from 'next/image';
import Link from 'next/link';
import type { Project } from '@/lib/api';
import { quoteHref, site } from '@/lib/site';
import { Container } from '../ui/Container';
import { Reveal } from '../ui/Reveal';
import { RotatingBadge } from '../ui/RotatingBadge';

/**
 * The home page opens on the work itself, not a slogan (BP&O's split, owner's request
 * 3 Oct 2026): "Latest" is the newest project, big; "Discover" is the next four in a 2×2 grid.
 */
export function Hero({ projects }: { projects: Project[] }) {
  const [latest, ...rest] = projects;
  if (!latest) return null;
  const discover = rest.slice(0, 4);

  return (
    <section aria-labelledby="latest-title" className="border-b border-border">
      <h1 className="sr-only">
        {site.name}: printing and branding in {site.location}
      </h1>
      <Container className="grid grid-cols-1 lg:grid-cols-2">
        <div className="py-10 sm:py-14 lg:border-r lg:border-border lg:pr-10">
          <Reveal>
            <ColumnHeading id="latest-title" title="Latest" subtitle="Fresh off the press" />
          </Reveal>
          <Reveal delay={80} className="relative mt-8 sm:mt-10">
            <ProjectLink project={latest} size="large" priority />
            {/* Inside the photo on phones and tablets; over its corner on desktop, where the column has room. */}
            <div className="absolute top-3 right-3 lg:top-0 lg:right-0 lg:translate-x-1/4 lg:-translate-y-1/3">
              <RotatingBadge href={quoteHref} label="Get a quote" id="hero-badge" />
            </div>
          </Reveal>
        </div>

        <div className="border-t border-border py-10 sm:py-14 lg:border-t-0 lg:pl-10">
          <Reveal>
            <ColumnHeading id="discover-title" title="Discover" subtitle="From the Noorcom archive" />
          </Reveal>
          <ul className="mt-8 grid grid-cols-1 gap-x-5 gap-y-8 sm:mt-10 sm:grid-cols-2">
            {discover.map((project, i) => (
              <Reveal as="li" key={project.slug} delay={120 + i * 70}>
                <ProjectLink project={project} size="small" />
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

function ColumnHeading({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return (
    <hgroup>
      <h2 id={id} className="text-[clamp(2.5rem,4.5vw,4rem)] leading-none font-bold tracking-[-0.035em]">
        {title}
      </h2>
      <p className="mt-2 font-display text-xl text-muted sm:text-2xl">{subtitle}</p>
    </hgroup>
  );
}

function ProjectLink({ project, size, priority }: { project: Project; size: 'large' | 'small'; priority?: boolean }) {
  const large = size === 'large';
  return (
    <Link href={`/work/${project.slug}`} className="group block">
      {/* The large card is taller on desktop so it lines up with the 2×2 grid beside it. */}
      <div className={`relative aspect-[3/2] overflow-hidden bg-panel ${large ? 'lg:aspect-square xl:aspect-[6/5]' : ''}`}>
        <Image
          src={project.cover.src}
          alt={project.cover.alt}
          fill
          priority={priority}
          sizes={large ? '(min-width: 1024px) 50vw, 100vw' : '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw'}
          className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
        />
        {project.sample && (
          <span className="absolute top-3 left-3 bg-bg px-2.5 py-1 text-[0.7rem] font-semibold tracking-[0.14em] text-heading uppercase">
            Sample
          </span>
        )}
      </div>
      <h3
        className={`mt-4 leading-tight font-bold tracking-[-0.02em] transition-colors group-hover:text-accent-ink ${
          large ? 'text-[clamp(1.6rem,2.6vw,2.25rem)]' : 'text-xl sm:text-2xl lg:text-lg xl:text-2xl'
        }`}
      >
        {project.title}
      </h3>
      <p className="mt-1.5 text-sm text-muted">
        {project.client} · {project.industry} · {project.year}
      </p>
    </Link>
  );
}
