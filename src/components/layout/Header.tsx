'use client';

import { ArrowUpRight, ClipboardList, Mail, Phone, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { pad2 } from '@/lib/format';
import { mainNav, quoteHref, site } from '@/lib/site';
import { useQuoteList } from '../shop/useQuoteList';
import { ButtonLink } from '../ui/ButtonLink';
import { Container } from '../ui/Container';
import { CmykDots } from '../ui/PrintMarks';
import { Logo } from './Logo';

/**
 * Sticky header. Desktop shows the main links inline; every size has the Menu button, which
 * opens a full-screen menu (Agrumea). The menu is a modal dialog: focus moves in, Tab stays
 * inside, Escape or a route change closes it and focus returns to the button.
 */
export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const quoteCount = useQuoteList().items.length;
  const quoteLabel = quoteCount ? `Your quote, ${quoteCount} ${quoteCount === 1 ? 'item' : 'items'}` : undefined;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close on navigation. Adjusting state while rendering is React's pattern for this.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    const focusables = () =>
      Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const button = menuButton.current;
    return () => {
      root.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      button?.focus();
    };
  }, [open]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={`sticky top-0 z-40 bg-bg/95 backdrop-blur transition-[border-color,box-shadow] duration-300 ${
        scrolled ? 'border-b border-border' : 'border-b border-transparent'
      }`}
    >
      <Container className="flex h-18 items-center justify-between gap-6">
        <Logo />

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isCurrent(item.href) ? 'page' : undefined}
                  className="group relative py-2 text-[0.95rem] font-medium text-heading"
                >
                  {item.label}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100 group-aria-[current=page]:scale-x-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Phones: a compact link once the quote list has items. */}
          {quoteCount > 0 && (
            <Link
              href={quoteHref}
              aria-label={quoteLabel}
              className="relative grid size-12 place-items-center text-heading sm:hidden"
            >
              <ClipboardList aria-hidden className="size-6" />
              <span aria-hidden className="absolute top-1.5 right-1 grid min-w-5 place-items-center rounded-pill bg-accent px-1 text-xs font-bold text-ink">
                {quoteCount}
              </span>
            </Link>
          )}
          {/* Wrapped: ButtonLink's own inline-flex would beat a `hidden` passed to it. */}
          <div className="hidden sm:block">
            <ButtonLink href={quoteHref} variant="accent" arrow={!quoteCount}>
              {quoteCount ? (
                <span className="inline-flex items-center gap-2">
                  <span className="sr-only">{quoteLabel}</span>
                  <span aria-hidden>Your quote</span>
                  <span aria-hidden className="grid min-w-6 place-items-center rounded-pill bg-ink px-1.5 text-xs font-bold text-bg">
                    {quoteCount}
                  </span>
                </span>
              ) : (
                'Get a quote'
              )}
            </ButtonLink>
          </div>
          <button
            ref={menuButton}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="site-menu"
            className="group inline-flex min-h-12 items-center gap-3 px-3 text-[0.95rem] font-semibold text-heading lg:hidden"
          >
            Menu
            <span aria-hidden className="flex w-6 flex-col gap-1.5">
              <span className="h-0.5 w-full bg-current transition-transform duration-300 group-hover:translate-x-1" />
              <span className="h-0.5 w-full bg-current" />
            </span>
          </button>
        </div>
      </Container>

      {open && (
        <div
          ref={dialog}
          id="site-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-paper"
        >
          <Container className="flex h-18 shrink-0 items-center justify-between">
            <Logo />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 items-center gap-2 px-3 text-[0.95rem] font-semibold text-heading"
            >
              Close
              <X aria-hidden className="size-6" />
            </button>
          </Container>

          <Container className="grid flex-1 grid-cols-1 content-between gap-12 py-10 md:grid-cols-[1fr_auto] md:content-center">
            <nav aria-label="Menu">
              <ol className="flex flex-col">
                {mainNav.map((item, i) => (
                  <li key={item.href} className="border-b border-border first:border-t">
                    <Link
                      href={item.href}
                      aria-current={isCurrent(item.href) ? 'page' : undefined}
                      className="group flex items-baseline gap-5 py-4 sm:py-5"
                    >
                      <span className="text-sm font-semibold text-muted tabular-nums">{pad2(i + 1)}</span>
                      <span className="font-display text-[clamp(2.4rem,9vw,5.5rem)] leading-[0.95] font-bold text-heading transition-transform duration-500 ease-out group-hover:translate-x-3">
                        {item.label}
                      </span>
                      <ArrowUpRight
                        aria-hidden
                        className="ml-auto size-7 self-center text-accent-ink opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      />
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="flex flex-col gap-6 md:min-w-72">
              <ButtonLink href={quoteHref} variant="accent" className="self-start">
                Get a quote
              </ButtonLink>
              <ul className="flex flex-col gap-3 text-body">
                <li>
                  <a href={site.phoneHref} className="inline-flex min-h-11 items-center gap-3 hover:text-heading">
                    <Phone aria-hidden className="size-4" />
                    {site.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center gap-3 hover:text-heading">
                    <Mail aria-hidden className="size-4" />
                    {site.email}
                  </a>
                </li>
              </ul>
              <p className="flex items-center gap-3 text-sm text-muted">
                <CmykDots />
                Designed and printed in {site.location}
              </p>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
