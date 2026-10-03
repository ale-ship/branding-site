'use client';

import { useEffect } from 'react';
import { Container } from '@/components/ui/Container';
import { CropMarks } from '@/components/ui/PrintMarks';
import { site } from '@/lib/site';

/** Shown when a page fails to render. Offers a retry and the ways to reach us. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-24 sm:py-36">
      <div className="relative max-w-3xl">
        <CropMarks />
        <div className="bg-paper p-8 sm:p-14">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Something went wrong</p>
          <h1 className="mt-5 text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.95] font-extrabold">This page jammed in the press.</h1>
          <p className="mt-6 max-w-lg text-lg text-body">Try again in a moment. If it keeps happening, WhatsApp us and we’ll help.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-12 items-center bg-ink px-6 font-semibold text-bg transition-colors hover:bg-ink-hover"
            >
              Try again
            </button>
            <a
              href={site.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center border border-ink px-6 font-semibold text-ink transition-colors hover:bg-ink hover:text-bg"
            >
              WhatsApp us
            </a>
          </div>
          {error.digest && <p className="mt-8 text-sm text-muted">Reference: {error.digest}</p>}
        </div>
      </div>
    </Container>
  );
}
