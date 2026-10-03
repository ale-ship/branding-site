import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/contact/ContactForm';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/PrintMarks';
import { PageHeader } from '@/components/ui/PageHeader';
import { quoteHref, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Visit us at ${site.address}, call ${site.phone}, WhatsApp us or email ${site.email}.`,
  alternates: { canonical: '/contact' },
};

const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent('Chuka Elimu Plaza, Loita Street, Nairobi')}&z=17&output=embed`;

const ways = [
  { icon: MessageCircle, label: 'WhatsApp', value: 'Chat with us', note: 'Fastest. Send photos and artwork here too.', href: site.whatsappHref, external: true },
  { icon: Phone, label: 'Call', value: site.phone, note: 'Talk to the studio.', href: site.phoneHref, external: false },
  { icon: Mail, label: 'Email', value: site.email, note: 'For big files and formal requests.', href: `mailto:${site.email}`, external: false },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Come and see us, or just say hello"
        intro="Visit the studio on Loita Street, or reach us the way that suits you. We reply within one working day."
      />

      <Container className="grid grid-cols-1 gap-16 pb-20 sm:pb-28 lg:grid-cols-2 lg:gap-20">
        <div className="flex flex-col gap-12">
          <ul className="border-t border-ink">
            {ways.map((way) => (
              <li key={way.label} className="border-b border-border">
                <a
                  href={way.href}
                  {...(way.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 py-6"
                >
                  <span aria-hidden className="grid size-12 place-items-center bg-paper text-heading transition-colors group-hover:bg-accent">
                    <way.icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-[0.18em] text-muted uppercase">{way.label}</span>
                    <span className="mt-1 block font-display text-xl font-bold break-words text-heading sm:text-2xl">{way.value}</span>
                    <span className="mt-1 block text-sm text-muted">{way.note}</span>
                  </span>
                  <ArrowUpRight aria-hidden className="size-6 text-heading transition-transform duration-300 group-hover:rotate-45" />
                </a>
              </li>
            ))}
          </ul>

          <div>
            <Eyebrow>Visit</Eyebrow>
            <p className="mt-4 flex items-start gap-3 font-display text-2xl leading-snug font-bold text-heading">
              <MapPin aria-hidden className="mt-1.5 size-5 shrink-0" />
              {site.address}
            </p>
            {/* TODO(business): opening hours, then show them here and in the footer. */}
            <p className="mt-3 text-body">First floor, Chuka Elimu Plaza. Call ahead if you’re coming to see samples.</p>
            <div className="relative mt-6 aspect-[4/3] overflow-hidden border border-border bg-panel">
              <iframe
                src={mapEmbed}
                title={`Map showing ${site.address}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 size-full"
              />
            </div>
            <a
              href={site.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-heading underline decoration-border-strong underline-offset-4 hover:decoration-ink"
            >
              Open in Google Maps
              <ArrowUpRight aria-hidden className="size-4" />
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-10 lg:sticky lg:top-28 lg:self-start">
          <div className="bg-paper p-6">
            <p className="font-display text-xl font-bold text-heading">Looking for a price?</p>
            <p className="mt-2 text-body">The quote form asks the right questions, so we can price your job in one go.</p>
            <Link
              href={quoteHref}
              className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-heading underline decoration-accent decoration-2 underline-offset-4"
            >
              Get a quote
              <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </div>
          <ContactForm />
        </div>
      </Container>
    </>
  );
}
