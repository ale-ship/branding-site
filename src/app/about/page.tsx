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
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: 'A design studio and a print workshop under one roof in Nairobi: we design it, print it and install it.',
  alternates: { canonical: '/about' },
};

/** TODO(business): Noorcom to confirm or rewrite the story and the principles. */
const principles = [
  {
    title: 'One team, start to finish',
    text: 'The designer who draws your sign talks to the printer who prints it and the installer who fits it. Nothing gets lost in between.',
  },
  {
    title: 'A proof before anything is printed',
    text: 'You see exactly what you’re getting, on screen or as a sample, and nothing runs until you say yes.',
  },
  {
    title: 'Made to last',
    text: 'UV-resistant inks, cast vinyls, proper laminates. We’d rather do the job once than redo it next rainy season.',
  },
];

const workshop = [
  { src: '/images/placeholder/print-latex.jpg', alt: 'A latex printer in the print room', caption: 'Wide-format latex printing' },
  { src: '/images/placeholder/press-offset.jpg', alt: 'An offset press with its ink rollers', caption: 'Offset press for long runs' },
  { src: '/images/placeholder/apparel-press.jpg', alt: 'A yellow t-shirt on the press', caption: 'Apparel printing' },
  { src: '/images/placeholder/screen-inks.jpg', alt: 'Tubs of screen-printing ink', caption: 'Inks mixed to your colours' },
];

export default async function AboutPage() {
  const clients = await api.listClients();
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="A design studio and a print workshop under one roof"
        intro={`${site.name} designs, prints and installs branding for businesses across Kenya, from a box of business cards to a fleet of vans.`}
      />

      <Container>
        <Reveal className="relative">
          <div className="relative aspect-[4/3] overflow-hidden bg-panel sm:aspect-[21/9]">
            <Image
              src="/images/placeholder/print-wide-format.jpg"
              alt="Our wide-format printer feeding out a printed banner"
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
            {/* TODO(business): the real story: when Noorcom started, who started it, the first big job. */}
            <p>
              Most businesses we meet have been passed between a designer, a printer and an installer, and the job got worse at
              every hand-over. We built Noorcom so it doesn’t.
            </p>
            <p>
              Our studio and our workshop share a floor on Loita Street. We design it, print it on our own machines and install it
              ourselves, so the sign on your wall looks like the one you approved.
            </p>
          </div>
        </Reveal>
      </Container>

      <section aria-labelledby="principles-title" className="bg-paper py-20 sm:py-28">
        <Container>
          <Reveal>
            <Eyebrow>How we work</Eyebrow>
            <h2 id="principles-title" className="mt-4 max-w-3xl text-[clamp(2.1rem,4.6vw,4rem)] leading-[1] font-bold">
              Three things we don’t compromise on
            </h2>
          </Reveal>
          <ol className="mt-12 grid grid-cols-1 gap-px border-y border-border-strong bg-border-strong md:grid-cols-3">
            {principles.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 90} className="flex flex-col gap-8 bg-paper py-8 md:px-8 md:first:pl-0">
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
              <Eyebrow>The workshop</Eyebrow>
              <h2 id="workshop-title" className="mt-4 text-[clamp(2.1rem,4.6vw,4rem)] leading-[1] font-bold">
                The machines behind the work
              </h2>
            </div>
            <ButtonLink href="/contact" variant="outline" className="self-start">
              Visit the studio
            </ButtonLink>
          </Reveal>
          <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {workshop.map((photo, i) => (
              <Reveal as="li" key={photo.src} delay={i * 80}>
                <figure>
                  <div className="relative aspect-[4/5] overflow-hidden bg-panel">
                    <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
                  </div>
                  <figcaption className="mt-3 text-sm text-muted">{photo.caption}</figcaption>
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
