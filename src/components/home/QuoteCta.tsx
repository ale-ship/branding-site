import { api } from '@/lib/api';
import { quoteHref, site } from '@/lib/site';
import { ButtonLink } from '../ui/ButtonLink';
import { Container } from '../ui/Container';
import { CropMarks, Eyebrow } from '../ui/PrintMarks';
import { Reveal } from '../ui/Reveal';

/** The orange "Have a job in mind?" block. `href` lets a service page preselect its service. */
export async function QuoteCta({ href = quoteHref }: { href?: string }) {
  const { eyebrow, title, text } = (await api.getPageContent()).home.cta;
  return (
    <section aria-labelledby="cta-title" className="pb-20 sm:pb-32">
      <Container>
        <Reveal className="relative bg-accent px-6 py-16 sm:px-12 sm:py-24 lg:px-20">
          <CropMarks className="text-on-accent" />
          <Eyebrow className="text-on-accent">{eyebrow}</Eyebrow>
          <h2 id="cta-title" className="mt-5 max-w-4xl text-[clamp(2.5rem,7vw,6.5rem)] leading-[0.95] font-extrabold text-on-accent">
            {title}
          </h2>
          <p className="mt-6 max-w-xl text-lg text-on-accent">{text}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href={href} variant="primary">
              Get a quote
            </ButtonLink>
            <ButtonLink href={site.whatsappHref} variant="on-dark" external>
              WhatsApp us
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
