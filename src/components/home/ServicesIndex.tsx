import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { Service } from '@/lib/api';
import { pad2 } from '@/lib/format';
import { Container } from '../ui/Container';
import { Reveal } from '../ui/Reveal';
import { SectionHeading } from './SectionHeading';

/**
 * A numbered index of services. On desktop each row's photo opens out on hover or focus;
 * on phones the photo is always shown as a thumbnail.
 */
export function ServicesIndex({ services }: { services: Service[] }) {
  return (
    <section aria-labelledby="services-title" className="bg-paper py-20 sm:py-32">
      <Container>
        <SectionHeading
          id="services-title"
          eyebrow="What we do"
          title="Seven ways to put your brand in front of people"
          intro="One team from the first sketch to the final install, so nothing gets lost between the designer and the printer."
          link={{ href: '/services', label: 'All services' }}
        />
        <ol className="border-t border-ink">
          {services.map((service, i) => (
            <Reveal as="li" key={service.slug} className="border-b border-border-strong">
              <Link
                href={`/services/${service.slug}`}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-6 sm:gap-8 sm:py-8"
              >
                <span className="self-start pt-2 text-sm font-semibold text-muted tabular-nums sm:pt-4">
                  {pad2(i + 1)}
                </span>
                <span className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
                  <span className="font-display text-[clamp(1.75rem,4vw,3.5rem)] leading-none font-bold tracking-[-0.03em] text-heading transition-transform duration-500 ease-out group-hover:translate-x-2">
                    {service.name}
                  </span>
                  <span className="text-body">
                    {service.summary}
                    <span className="mt-2 block text-sm text-muted">{service.includes.join(' · ')}</span>
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="relative block aspect-[4/3] w-20 overflow-hidden bg-panel transition-[width] duration-500 ease-out sm:w-28 lg:w-0 lg:group-hover:w-52 lg:group-focus-visible:w-52">
                    <Image src={service.image.src} alt="" fill sizes="208px" className="object-cover" />
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="hidden size-7 text-heading transition-transform duration-300 group-hover:rotate-45 sm:block"
                  />
                </span>
              </Link>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
