import Link from 'next/link';
import { api } from '@/lib/api';
import { mainNav, quoteHref, site } from '@/lib/site';
import { Container } from '../ui/Container';
import { CmykDots } from '../ui/PrintMarks';
import { Logo } from './Logo';

const linkClass = 'inline-flex min-h-11 items-center text-body transition-colors hover:text-heading';

export async function Footer() {
  const services = await api.listServices();
  return (
    <footer className="border-t border-border bg-paper">
      {/* Extra bottom space so the floating WhatsApp button never covers the last line. */}
      <Container className="pt-16 pb-24 sm:pt-24 sm:pb-28">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="flex flex-col items-start gap-6 sm:col-span-2 xl:col-span-1">
            <Logo />
            <p className="max-w-sm text-body">{site.description}</p>
            <Link
              href={quoteHref}
              className="group inline-flex min-h-12 items-center font-display text-3xl font-bold text-heading underline decoration-accent decoration-2 underline-offset-8 transition-colors hover:text-accent-ink sm:text-4xl"
            >
              Start a job →
            </Link>
          </div>

          <nav aria-label="Footer">
            <h2 className="mb-3 font-sans text-xs font-semibold tracking-[0.18em] text-muted uppercase">Explore</h2>
            <ul>
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={quoteHref} className={linkClass}>
                  Get a quote
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="mb-3 font-sans text-xs font-semibold tracking-[0.18em] text-muted uppercase">Services</h2>
            <ul>
              {services.map((service) => (
                <li key={service.slug}>
                  <Link href={`/services/${service.slug}`} className={linkClass}>
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xs font-semibold tracking-[0.18em] text-muted uppercase">Contact</h2>
            <ul>
              <li>
                <a href={site.phoneHref} className={linkClass}>
                  {site.phone}
                </a>
              </li>
              <li>
                <a href={site.whatsappHref} className={linkClass} target="_blank" rel="noopener noreferrer">
                  WhatsApp us
                </a>
              </li>
              <li>
                <a href={`mailto:${site.email}`} className={`${linkClass} break-all`}>
                  {site.email}
                </a>
              </li>
              <li>
                <a href={site.mapUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                  {site.address}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-border pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span>
              © {new Date().getFullYear()} {site.name}. All rights reserved.
            </span>
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-heading">
              Privacy
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-heading">
              Terms
            </Link>
          </p>
          <p className="flex items-center gap-3">
            <CmykDots />
            Designed, printed and installed in Nairobi
          </p>
        </div>
      </Container>
    </footer>
  );
}
