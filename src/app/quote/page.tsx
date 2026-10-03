import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { QuoteForm } from '@/components/quote/QuoteForm';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/PrintMarks';
import { PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { pad2 } from '@/lib/format';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Get a quote',
  description: 'Tell us about your printing or branding job and get a price within one working day.',
  alternates: { canonical: '/quote' },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** TODO(business): confirm the reply time. */
const nextSteps = [
  { title: 'We reply within a working day', text: 'With a price, the materials we recommend and a turnaround.' },
  { title: 'You approve a proof', text: 'Nothing is printed until you’ve seen and approved it.' },
  { title: 'We make it and bring it', text: 'Printed in our workshop; collected, delivered or installed.' },
];

export default async function QuotePage({ searchParams }: Props) {
  const [params, services] = await Promise.all([searchParams, api.listServices()]);
  const asked = Array.isArray(params.service) ? params.service[0] : params.service;
  const initialService = services.some((s) => s.slug === asked) ? (asked as string) : '';

  return (
    <>
      <PageHeader
        eyebrow="Get a quote"
        title="Tell us about the job"
        intro="It takes about two minutes. We’ll come back with a price, and a proof where it helps, within one working day."
      />
      <Container className="grid grid-cols-1 gap-14 pb-20 sm:pb-32 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <QuoteForm
            services={services.map(({ slug, name, summary }) => ({ slug, name, summary }))}
            initialService={initialService}
            whatsappHref={site.whatsappHref}
            email={site.email}
          />
        </div>

        <aside aria-label="What happens next" className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>What happens next</Eyebrow>
          <ol className="mt-5 border-t border-ink">
            {nextSteps.map((s, i) => (
              <li key={s.title} className="flex gap-4 border-b border-border py-5">
                <span className="text-sm font-semibold text-muted tabular-nums">{pad2(i + 1)}</span>
                <span>
                  <span className="block font-semibold text-heading">{s.title}</span>
                  <span className="mt-1 block text-sm text-body">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-10 bg-paper p-6">
            <p className="font-display text-xl font-bold text-heading">Rather talk to someone?</p>
            <ul className="mt-4 flex flex-col">
              <li>
                <a href={site.whatsappHref} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 text-heading hover:text-accent-ink">
                  <MessageCircle aria-hidden className="size-4" /> WhatsApp us
                </a>
              </li>
              <li>
                <a href={site.phoneHref} className="flex min-h-11 items-center gap-3 text-heading hover:text-accent-ink">
                  <Phone aria-hidden className="size-4" /> {site.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${site.email}`} className="flex min-h-11 items-center gap-3 break-all text-heading hover:text-accent-ink">
                  <Mail aria-hidden className="size-4 shrink-0" /> {site.email}
                </a>
              </li>
              <li>
                <a href={site.mapUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-start gap-3 py-2.5 text-heading hover:text-accent-ink">
                  <MapPin aria-hidden className="mt-1 size-4 shrink-0" /> {site.address}
                </a>
              </li>
            </ul>
          </div>
        </aside>
      </Container>
    </>
  );
}
