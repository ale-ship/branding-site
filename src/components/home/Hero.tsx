import Image from 'next/image';
import { quoteHref, site } from '@/lib/site';
import { ButtonLink } from '../ui/ButtonLink';
import { Container } from '../ui/Container';
import { CropMarks, Eyebrow } from '../ui/PrintMarks';
import { Reveal } from '../ui/Reveal';
import { RotatingBadge } from '../ui/RotatingBadge';

const facts = [
  { value: 'In-house', label: 'Design, print and installation under one roof' },
  { value: 'From 50', label: 'Pieces on most branded items' },
  { value: 'Countrywide', label: 'Installs and delivery across Kenya' },
];

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden pt-10 sm:pt-16">
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <div>
            <Reveal>
              <Eyebrow>Printing and branding studio · {site.location}</Eyebrow>
            </Reveal>
            <Reveal delay={80}>
              <h1
                id="hero-title"
                className="mt-6 text-[clamp(2.9rem,8.2vw,8.25rem)] leading-[0.92] font-extrabold tracking-[-0.035em]"
              >
                We make brands <span className="text-accent-ink italic">impossible</span> to miss.
              </h1>
            </Reveal>
          </div>
          <Reveal delay={160} className="flex flex-col gap-7 lg:pb-3">
            <p className="max-w-md text-lg text-body">
              Signage, vehicle wraps, apparel, gifts and print, designed by our studio and made in our own
              Nairobi workshop.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={quoteHref} variant="primary">
                Get a quote
              </ButtonLink>
              <ButtonLink href="/work" variant="outline">
                See our work
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </Container>

      <Container className="mt-14 sm:mt-20">
        <Reveal delay={200} className="relative">
          <div className="relative aspect-[4/5] overflow-hidden bg-panel sm:aspect-[16/9] lg:aspect-[21/9]">
            <Image
              src="/images/placeholder/print-wide-format.jpg"
              alt="A wide-format printer feeding out a long printed banner in the workshop"
              fill
              priority
              sizes="(min-width: 1680px) 1600px, 100vw"
              className="object-cover"
            />
          </div>
          <CropMarks />
          <div className="absolute -top-14 right-4 sm:-top-18 sm:right-10">
            <RotatingBadge href={quoteHref} label="Get a quote" id="hero-badge" />
          </div>
          <p className="absolute bottom-4 left-4 flex items-center gap-3 bg-bg px-3 py-2 text-xs font-semibold tracking-[0.18em] text-heading uppercase sm:bottom-6 sm:left-6">
            <span aria-hidden className="relative h-6 w-px overflow-hidden bg-border">
              <span className="absolute inset-0 animate-cue bg-ink" />
            </span>
            Scroll to discover
          </p>
        </Reveal>
      </Container>

      <Container>
        <dl className="grid grid-cols-1 border-b border-border sm:grid-cols-3">
          {facts.map((fact, i) => (
            <Reveal
              key={fact.value}
              delay={i * 90}
              className="flex flex-col gap-1 border-t border-border py-6 sm:border-t-0 sm:py-8 sm:pr-8 sm:not-first:border-l sm:not-first:pl-8"
            >
              <dt className="sr-only">{fact.label}</dt>
              <dd className="font-display text-3xl font-bold text-heading">{fact.value}</dd>
              <dd className="text-muted">{fact.label}</dd>
            </Reveal>
          ))}
        </dl>
      </Container>
    </section>
  );
}
