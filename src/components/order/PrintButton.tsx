'use client';

import { Printer } from 'lucide-react';

/** Opens the browser's print dialog, where "Save as PDF" gives a PDF of the invoice. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 bg-ink px-5 font-semibold text-bg transition-colors hover:bg-ink-hover"
    >
      <Printer aria-hidden className="size-4" />
      Print or save as PDF
    </button>
  );
}
