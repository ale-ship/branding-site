import { ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Process } from '@/components/home/Process';
import { QuoteCta } from '@/components/home/QuoteCta';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/ui/Reveal';
import { api } from '@/lib/api';
import { pad2 } from '@/lib/format';
import { serviceHref } from '@/lib/services';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Indoor and outdoor branding, vehicle wraps, apparel, corporate gifts, stationery and large-format printing, designed and made in Nairobi.',
  alternates: { canonical: '/services' },
};

export default async function ServicesPage() {
  const services = await api.listServices();
  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="Everything your brand needs to be seen"
        intro="Seven services, one team. We design it, print it in our own workshop and install it, so nothing gets lost between the designer and the printer."
      />

      <Container className="pb-20 sm:pb-32">
        <ol className="grid grid-cols-1 gap-x-6 gap-y-14 border-t border-ink pt-10 sm:grid-cols-2 lg:gap-y-20">
          {services.map((service, i) => (
            <Reveal as="li" key={service.slug} delay={(i % 2) * 100}>
              <Link href={serviceHref(service.slug)} className="group block">
                <div className="relative aspect-[3/2] overflow-hidden bg-panel">
                  <Image
                    src={service.image.src}
                    alt={service.image.alt}
                    fill
                    priority={i < 2}
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="mt-5 flex items-start gap-4">
                  <span className="pt-2 text-sm font-semibold text-muted tabular-nums">{pad2(i + 1)}</span>
                  <div className="flex-1">
                    <h2 className="flex items-start justify-between gap-4 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-bold transition-colors group-hover:text-accent-ink">
                      {service.name}
                      <ArrowUpRight
                        aria-hidden
                        className="mt-1.5 size-6 shrink-0 transition-transform duration-300 group-hover:rotate-45"
                      />
                    </h2>
                    <p className="mt-2 text-body">{service.summary}</p>
                    <p className="mt-3 text-sm text-muted">{service.includes.join(' · ')}</p>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </ol>
      </Container>

      <Process />
      <div className="pt-20 sm:pt-32">
        <QuoteCta />
      </div>
    </>
  );
}
