import Image from 'next/image';
import { Container } from '../ui/Container';
import { CropMarks } from '../ui/PrintMarks';
import { Reveal } from '../ui/Reveal';

const facts = [
  { value: 'In-house', label: 'Design, print and installation under one roof' },
  { value: 'From 50', label: 'Pieces on most branded items' },
  { value: 'Countrywide', label: 'Installs and delivery across Kenya' },
];

/** The workshop's wide-format printer, full width with crop marks, and three facts below. */
export function WorkshopBand() {
  return (
    <section aria-label="Our workshop" className="pt-14 sm:pt-20">
      <Container>
        <Reveal className="relative">
          <div className="relative aspect-[4/5] overflow-hidden bg-panel sm:aspect-[16/9] lg:aspect-[21/9]">
            <Image
              src="/images/placeholder/print-wide-format.jpg"
              alt="Our wide-format printer feeding out a long printed banner in the workshop"
              fill
              sizes="(min-width: 1680px) 1600px, 100vw"
              className="object-cover"
            />
          </div>
          <CropMarks />
          <p className="absolute bottom-4 left-4 bg-bg px-3 py-2 text-xs font-semibold tracking-[0.18em] text-heading uppercase sm:bottom-6 sm:left-6">
            Printed in our Nairobi workshop
          </p>
        </Reveal>

        <dl className="mt-6 grid grid-cols-1 sm:mt-8 sm:grid-cols-3">
          {facts.map((fact, i) => (
            <Reveal
              key={fact.value}
              delay={i * 90}
              className="flex flex-col gap-1 border-t border-border py-6 sm:py-8 sm:pr-8 sm:not-first:border-l sm:not-first:pl-8"
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
