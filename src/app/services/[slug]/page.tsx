import { ArrowLeft, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Process } from '@/components/home/Process';
import { QuoteCta } from '@/components/home/QuoteCta';
import { SectionHeading } from '@/components/home/SectionHeading';
import { ShopTeaser } from '@/components/home/ShopTeaser';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Container } from '@/components/ui/Container';
import { CropMarks, Eyebrow } from '@/components/ui/PrintMarks';
import { Reveal } from '@/components/ui/Reveal';
import { ProjectCard } from '@/components/work/ProjectCard';
import { api } from '@/lib/api';
import { pad2 } from '@/lib/format';
import { relatedProducts, relatedProjects, serviceHref, serviceQuoteHref } from '@/lib/services';
import { site } from '@/lib/site';
import { workHref } from '@/lib/work';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await api.listServices()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = await api.getService((await params).slug);
  if (!service) return {};
  return {
    title: service.name,
    description: service.summary,
    alternates: { canonical: serviceHref(service.slug) },
    openGraph: { title: service.name, description: service.summary, images: [{ url: service.image.src, alt: service.image.alt }] },
  };
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const [service, services, projects, products, orderCategories, orderProducts] = await Promise.all([
    api.getService(slug),
    api.listServices(),
    api.listProjects(),
    api.listProducts(),
    api.listOrderCategories(),
    api.listOrderProducts(),
  ]);
  if (!service) notFound();

  const index = services.findIndex((s) => s.slug === service.slug);
  // Online ordering for this service: a site job books a survey; anything else links to its products.
  const category = orderCategories.find((c) => c.service === service.slug);
  const siteJob = orderProducts.find((p) => p.mechanism === 'B' && p.category === category?.slug);
  const orderEntry = siteJob
    ? { href: `/order/new?product=${siteJob.slug}`, label: 'Book a site survey' }
    : category
      ? { href: `/order#cat-${category.slug}`, label: 'Order online' }
      : null;
  const work = relatedProjects(service, projects);
  const shop = relatedProducts(service, products);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: service.name,
      description: service.intro,
      serviceType: service.name,
      areaServed: { '@type': 'Country', name: 'Kenya' },
      provider: { '@type': 'LocalBusiness', name: site.name, url: site.url },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: service.faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
  ];

  const keyFacts = [
    { label: 'Turnaround', value: service.turnaround, note: 'From your approved proof' },
    { label: 'Smallest job', value: service.minimum, note: 'Bigger runs cost less per piece' },
    { label: 'Coverage', value: 'Countrywide', note: 'Delivery and installation across Kenya' },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <Container className="pt-8 sm:pt-12">
        <Link href="/services" className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-heading">
          <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-1" />
          All services
        </Link>
      </Container>

      <Container className="grid grid-cols-1 gap-10 pt-6 pb-12 sm:pt-10 sm:pb-16 lg:grid-cols-[1.5fr_1fr] lg:items-end">
        <Reveal>
          <Eyebrow>Service {pad2(index + 1)}</Eyebrow>
          <h1 className="mt-5 text-[clamp(2.75rem,7vw,6.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">{service.name}</h1>
        </Reveal>
        <Reveal delay={100} className="flex flex-col gap-7">
          <p className="text-lg text-body">{service.intro}</p>
          <div className="flex flex-wrap gap-3">
            {orderEntry && <ButtonLink href={orderEntry.href}>{orderEntry.label}</ButtonLink>}
            <ButtonLink href={serviceQuoteHref(service.slug)} variant={orderEntry ? 'outline' : 'primary'}>
              Get a quote
            </ButtonLink>
            <ButtonLink href={site.whatsappHref} variant="outline" external>
              WhatsApp us
            </ButtonLink>
          </div>
        </Reveal>
      </Container>

      <Container>
        <Reveal className="relative">
          <div className="relative aspect-[4/3] overflow-hidden bg-panel sm:aspect-[21/9]">
            <Image src={service.image.src} alt={service.image.alt} fill preload fetchPriority="high" sizes="(min-width: 1680px) 1600px, 100vw" className="object-cover" />
          </div>
          <CropMarks />
        </Reveal>

        <dl className="mt-6 grid grid-cols-1 sm:mt-8 sm:grid-cols-3">
          {keyFacts.map((fact, i) => (
            <Reveal
              key={fact.label}
              delay={i * 90}
              className="flex flex-col gap-1 border-t border-border py-6 sm:py-8 sm:pr-8 sm:not-first:border-l sm:not-first:pl-8"
            >
              <dt className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">{fact.label}</dt>
              <dd className="font-display text-2xl font-bold text-heading sm:text-3xl">{fact.value}</dd>
              <dd className="text-sm text-muted">{fact.note}</dd>
            </Reveal>
          ))}
        </dl>
      </Container>

      <Container className="py-20 sm:py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow>What we make</Eyebrow>
            <ol className="mt-6 border-t border-ink">
              {service.includes.map((item, i) => (
                <li key={item} className="flex items-baseline gap-5 border-b border-border py-4">
                  <span className="text-sm font-semibold text-muted tabular-nums">{pad2(i + 1)}</span>
                  <span className="font-display text-2xl font-bold text-heading">{item}</span>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={100}>
            <Eyebrow>Materials and finishes</Eyebrow>
            <ul className="mt-6 border-t border-ink">
              {service.materials.map((material) => (
                <li key={material} className="border-b border-border py-4 text-lg text-heading">
                  {material}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-body">
              Not sure what you need? Tell us where it will be used and we’ll recommend the right material.
            </p>
          </Reveal>
        </div>
      </Container>

      {work.length > 0 && (
        <section aria-labelledby="related-work-title" className="pb-20 sm:pb-28">
          <Container>
            <SectionHeading
              id="related-work-title"
              eyebrow="Work"
              title={`${service.name} we’ve done`}
              link={{ href: workHref({ service: service.slug }), label: 'See all of it' }}
            />
            <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {work.map((project, i) => (
                <Reveal as="li" key={project.slug} delay={i * 80}>
                  <ProjectCard project={project} size="grid" />
                </Reveal>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <Process />

      <ShopTeaser products={shop} title={`Ready to brand: ${service.name.toLowerCase()}`} />

      <section aria-labelledby="faq-title" className={`pb-20 sm:pb-28 ${shop.length ? '' : 'pt-20 sm:pt-28'}`}>
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <Reveal>
            <Eyebrow>Questions</Eyebrow>
            <h2 id="faq-title" className="mt-4 text-[clamp(2.1rem,4.6vw,4rem)] leading-[1] font-bold">
              Asked before you ask
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="border-t border-ink">
              {service.faqs.map((faq) => (
                <details key={faq.question} className="group border-b border-border">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-semibold text-heading [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <Plus aria-hidden className="size-5 shrink-0 transition-transform duration-300 group-open:rotate-45" />
                  </summary>
                  <p className="pb-6 text-body">{faq.answer}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </Container>
      </section>

      <QuoteCta href={serviceQuoteHref(service.slug)} />
    </>
  );
}
