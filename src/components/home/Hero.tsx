import type { Project } from '@/lib/api';
import { quoteHref, site } from '@/lib/site';
import { Container } from '../ui/Container';
import { ProjectCard } from '../work/ProjectCard';
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
          {/* No Reveal here: this column is the first thing on screen, and the big photo is the
              page's largest paint, so it shows at once instead of fading in. */}
          <ColumnHeading id="latest-title" title="Latest" subtitle="Fresh off the press" />
          <div className="relative mt-8 sm:mt-10">
            <ProjectCard project={latest} size="large" priority />
            {/* Inside the photo on phones and tablets; over its corner on desktop, where the column has room. */}
            <div className="absolute top-3 right-3 lg:top-0 lg:right-0 lg:translate-x-1/4 lg:-translate-y-1/3">
              <RotatingBadge href={quoteHref} label="Get a quote" id="hero-badge" />
            </div>
          </div>
        </div>

        <div className="border-t border-border py-10 sm:py-14 lg:border-t-0 lg:pl-10">
          <Reveal>
            <ColumnHeading id="discover-title" title="Discover" subtitle="From the Noorcom archive" />
          </Reveal>
          <ul className="mt-8 grid grid-cols-1 gap-x-5 gap-y-8 sm:mt-10 sm:grid-cols-2">
            {discover.map((project, i) => (
              <Reveal as="li" key={project.slug} delay={120 + i * 70}>
                <ProjectCard project={project} size="small" />
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
