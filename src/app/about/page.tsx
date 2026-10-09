import type { Metadata } from 'next';
import Image from 'next/image';
import { Clients } from '@/components/home/Clients';
import { Process } from '@/components/home/Process';
import { QuoteCta } from '@/components/home/QuoteCta';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Container } from '@/components/ui/Container';
import { CropMarks, Eyebrow } from '@/components/ui/PrintMarks';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/ui/Reveal';
import { api } from '@/lib/api';
import { pad2 } from '@/lib/format';

export const metadata: Metadata = {
  title: 'About',
  description: 'A design studio and a print workshop under one roof in Nairobi: we design it, print it and install it.',
  alternates: { canonical: '/about' },
};

/** Every word and photo comes from Website → Pages in the back office. */
export default async function AboutPage() {
  const [clients, { about }] = await Promise.all([api.listClients(), api.getPageContent()]);
  return (
    <>
      <PageHeader
        eyebrow="About"
        title={about.header.title}
        intro={about.header.intro}
      />

      <Container>
        <Reveal className="relative">
          <div className="relative aspect-[4/3] overflow-hidden bg-panel sm:aspect-[21/9]">
            <Image
              src={about.image.src}
              alt={about.image.alt}
              fill
              preload
              fetchPriority="high"
              sizes="(min-width: 1680px) 1600px, 100vw"
              className="object-cover"
            />
          </div>
          <CropMarks />
        </Reveal>
      </Container>

      <Container className="py-20 sm:py-28">
        <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] lg:gap-10">
          <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-muted uppercase lg:pt-3">Our story</h2>
          <div className="flex flex-col gap-6 font-display text-[clamp(1.4rem,2.5vw,2.1rem)] leading-[1.25] font-medium tracking-[-0.015em] text-heading">
            {about.story.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </Reveal>
      </Container>

      <section aria-labelledby="principles-title" className="bg-paper py-20 sm:py-28">
        <Container>
          <Reveal>
            <Eyebrow>{about.principles.eyebrow}</Eyebrow>
            <h2 id="principles-title" className="mt-4 max-w-3xl text-[clamp(2.1rem,4.6vw,4rem)] leading-[1] font-bold">
              {about.principles.title}
            </h2>
          </Reveal>
          <ol className="mt-12 grid grid-cols-1 gap-px border-y border-border-strong bg-border-strong md:grid-cols-3">
            {about.principles.items.map((p, i) => (
              <Reveal as="li" key={i} delay={i * 90} className="flex flex-col gap-8 bg-paper py-8 md:px-8 md:first:pl-0">
                <span className="text-sm font-semibold text-muted tabular-nums">{pad2(i + 1)}</span>
                <span>
                  <span className="block font-display text-2xl font-bold text-heading">{p.title}</span>
                  <span className="mt-3 block text-body">{p.text}</span>
                </span>
              </Reveal>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="workshop-title" className="py-20 sm:py-28">
        <Container>
          <Reveal className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <Eyebrow>{about.workshop.eyebrow}</Eyebrow>
              <h2 id="workshop-title" className="mt-4 text-[clamp(2.1rem,4.6vw,4rem)] leading-[1] font-bold">
                {about.workshop.title}
              </h2>
            </div>
            <ButtonLink href="/contact" variant="outline" className="self-start">
              Visit the studio
            </ButtonLink>
          </Reveal>
          <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {about.workshop.photos.map((photo, i) => (
              <Reveal as="li" key={i} delay={i * 80}>
                <figure>
                  <div className="relative aspect-[4/5] overflow-hidden bg-panel">
                    <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
                  </div>
                  {photo.caption && <figcaption className="mt-3 text-sm text-muted">{photo.caption}</figcaption>}
                </figure>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      <Process />
      <Clients clients={clients} />
      <div className="pt-20 sm:pt-32">
        <QuoteCta />
      </div>
    </>
  );
}
