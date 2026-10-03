import { ArrowLeft, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { CaptionedPhoto, Photo, Project, Service } from '@/lib/api';
import { projectHref } from '@/lib/work';
import { Container } from '../ui/Container';
import { CropMarks, Eyebrow } from '../ui/PrintMarks';
import { Reveal } from '../ui/Reveal';

/**
 * A project told as a case study, in Mindsparkle's order: intro and credits, cover, brief and
 * idea, numbers, colours and materials, the work in use, behind the scenes, before and after,
 * result, then the next project.
 */
export function CaseStudy({ project, services, next }: { project: Project; services: Service[]; next: Project | null }) {
  const serviceNames = project.services.map((slug) => services.find((s) => s.slug === slug)).filter((s) => !!s);
  return (
    <article>
      <Container className="pt-8 sm:pt-12">
        <Link href="/work" className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-heading">
          <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-1" />
          All work
        </Link>
      </Container>

      <Container className="pt-6 pb-10 sm:pt-10 sm:pb-14">
        <Reveal>
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>Case study</Eyebrow>
            {project.sample && (
              <span className="border border-ink px-2 py-0.5 text-[0.7rem] font-semibold tracking-[0.14em] text-heading uppercase">
                Sample
              </span>
            )}
          </div>
          <h1 className="mt-5 max-w-5xl text-[clamp(2.5rem,6.5vw,6rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">
            {project.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-body sm:text-xl">{project.summary}</p>
        </Reveal>

        <Reveal delay={100}>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-6 sm:grid-cols-3 lg:grid-cols-5">
            <Credit label="Client">{project.client}</Credit>
            <Credit label="Industry">{project.industry}</Credit>
            <Credit label="Year">{project.year}</Credit>
            <Credit label="Location">{project.location}</Credit>
            <Credit label="Services">
              {serviceNames.map((service, i) => (
                <span key={service.slug}>
                  {i > 0 && ', '}
                  <Link href={`/services/${service.slug}`} className="underline decoration-border-strong underline-offset-4 hover:decoration-ink">
                    {service.name}
                  </Link>
                </span>
              ))}
            </Credit>
          </dl>
        </Reveal>
      </Container>

      <Container>
        <Reveal className="relative">
          <div className="relative aspect-[4/3] overflow-hidden bg-panel sm:aspect-[16/9]">
            <Image src={project.cover.src} alt={project.cover.alt} fill priority sizes="(min-width: 1680px) 1600px, 100vw" className="object-cover" />
          </div>
          <CropMarks />
        </Reveal>
      </Container>

      <Container className="py-20 sm:py-28">
        <div className="flex flex-col gap-14 sm:gap-20">
          <Story label="The brief">{project.brief}</Story>
          <Story label="The idea">{project.idea}</Story>
        </div>
      </Container>

      {project.facts.length > 0 && (
        <Container>
          <dl className="grid grid-cols-1 border-y border-border sm:grid-cols-3">
            {project.facts.map((fact, i) => (
              <Reveal
                key={fact.label}
                delay={i * 90}
                className="flex flex-col gap-1 py-8 not-first:border-t not-first:border-border sm:pr-8 sm:not-first:border-t-0 sm:not-first:border-l sm:not-first:pl-8"
              >
                <dt className="sr-only">{fact.label}</dt>
                <dd className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-none font-extrabold text-heading">{fact.value}</dd>
                <dd className="text-muted">{fact.label}</dd>
              </Reveal>
            ))}
          </dl>
        </Container>
      )}

      <Container className="py-20 sm:py-28">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow>Colours</Eyebrow>
            <ul className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
              {project.palette.map((colour) => (
                <li key={colour}>
                  <span className="block aspect-square border border-border" style={{ backgroundColor: colour }} />
                  <span className="mt-2 block font-mono text-sm text-muted uppercase">{colour}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100}>
            <Eyebrow>Materials and finishes</Eyebrow>
            <ul className="mt-6 border-t border-ink">
              {project.materials.map((material) => (
                <li key={material} className="border-b border-border py-4 text-lg text-heading">
                  {material}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>

      {project.applications.length > 0 && (
        <Container className="pb-20 sm:pb-28">
          <Reveal>
            <Eyebrow>The work</Eyebrow>
          </Reveal>
          <Gallery photos={project.applications} className="mt-8" />
        </Container>
      )}

      {project.behindTheScenes.length > 0 && (
        <section aria-labelledby="bts-title" className="bg-paper py-20 sm:py-28">
          <Container>
            <Reveal className="mb-10 max-w-2xl">
              <Eyebrow>Behind the scenes</Eyebrow>
              <h2 id="bts-title" className="mt-4 text-[clamp(2rem,4vw,3.25rem)] leading-[1] font-bold">
                Made in our own workshop
              </h2>
            </Reveal>
            <Gallery photos={project.behindTheScenes} />
          </Container>
        </section>
      )}

      {project.beforeAfter && <BeforeAfter before={project.beforeAfter.before} after={project.beforeAfter.after} />}

      <Container className="py-20 sm:py-28">
        <Story label="The result">{project.result}</Story>
      </Container>

      {next && (
        <Container className="pb-20 sm:pb-28">
          <Link href={projectHref(next.slug)} className="group grid grid-cols-1 items-center gap-6 border-t border-ink pt-8 sm:grid-cols-[1fr_auto] sm:gap-10">
            <span>
              <span className="block text-xs font-semibold tracking-[0.18em] text-muted uppercase">Next project</span>
              <span className="mt-3 flex items-start gap-4 font-display text-[clamp(1.9rem,4.5vw,3.75rem)] leading-[1.02] font-bold text-heading transition-colors group-hover:text-accent-ink">
                {next.title}
                <ArrowRight aria-hidden className="mt-2 size-8 shrink-0 transition-transform duration-300 group-hover:translate-x-2 sm:size-10" />
              </span>
            </span>
            <span className="relative block aspect-[3/2] w-full overflow-hidden bg-panel sm:w-72">
              <Image src={next.cover.src} alt="" fill sizes="(min-width: 640px) 288px, 100vw" className="object-cover transition-transform duration-[1.2s] group-hover:scale-[1.05]" />
            </span>
          </Link>
        </Container>
      )}
    </article>
  );
}

function Credit({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">{label}</dt>
      <dd className="mt-1.5 text-heading">{children}</dd>
    </div>
  );
}

/** A label in the left column, a large statement on the right. */
function Story({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] lg:gap-10">
      <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-muted uppercase lg:pt-3">{label}</h2>
      <p className="font-display text-[clamp(1.5rem,2.8vw,2.4rem)] leading-[1.2] font-medium tracking-[-0.015em] text-heading">
        {children}
      </p>
    </Reveal>
  );
}

/** First photo full width, the rest two by two, each with its caption. */
function Gallery({ photos, className = '' }: { photos: CaptionedPhoto[]; className?: string }) {
  return (
    <ul className={`grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 ${className}`}>
      {photos.map((photo, i) => {
        const wide = i === 0 || (photos.length % 2 === 0 && i === photos.length - 1);
        return (
          <Reveal as="li" key={`${photo.src}-${i}`} delay={(i % 2) * 100} className={wide ? 'sm:col-span-2' : ''}>
            <figure>
              <div className={`relative overflow-hidden bg-panel ${wide ? 'aspect-[4/3] sm:aspect-[16/9]' : 'aspect-[4/3]'}`}>
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes={wide ? '(min-width: 1680px) 1600px, 100vw' : '(min-width: 640px) 50vw, 100vw'}
                  className="object-cover"
                />
              </div>
              {photo.caption && <figcaption className="mt-3 text-sm text-muted">{photo.caption}</figcaption>}
            </figure>
          </Reveal>
        );
      })}
    </ul>
  );
}

/** Brand New's before and after, side by side, labelled. */
function BeforeAfter({ before, after }: { before: Photo; after: Photo }) {
  return (
    <Container className="pt-20 sm:pt-28">
      <Reveal>
        <Eyebrow>Before and after</Eyebrow>
      </Reveal>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {[
          { label: 'Before', photo: before },
          { label: 'After', photo: after },
        ].map(({ label, photo }) => (
          <Reveal key={label}>
            <figure className="relative">
              <div className="relative aspect-[4/3] overflow-hidden bg-panel">
                <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
              </div>
              <figcaption className="absolute top-3 left-3 bg-bg px-2.5 py-1 text-[0.7rem] font-semibold tracking-[0.14em] text-heading uppercase">
                {label}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Container>
  );
}
