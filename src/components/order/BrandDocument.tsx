import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { invoiceIssuer, site } from '@/lib/site';
import { PrintButton } from './PrintButton';

/**
 * The frame shared by invoices and receipts, after Noorcom's invoice template: A4, a red bar, the
 * logo, the document's name and number with one highlighted figure, and the company footer. The
 * page around it (back link, print button) is hidden when printing.
 */
export function BrandDocument({
  backHref,
  backLabel,
  label,
  title,
  number,
  highlight,
  children,
}: {
  backHref: string;
  backLabel: string;
  /** For screen readers: "Invoice INV00001". */
  label: string;
  title: string;
  number: string;
  highlight: { label: string; value: string };
  children: ReactNode;
}) {
  return (
    <div className="bg-panel py-8 print:bg-bg print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-4 px-4 print:hidden">
        <Link href={backHref} className="inline-flex min-h-11 items-center font-semibold text-heading underline underline-offset-4">
          {backLabel}
        </Link>
        <PrintButton />
      </div>

      <article aria-label={label} className="mx-auto flex min-h-[297mm] max-w-[210mm] flex-col bg-bg text-[13px] text-body shadow-sm print:min-h-0 print:shadow-none">
        <div className="h-2 bg-brand-red" />
        <div className="flex flex-1 flex-col px-[8mm] pt-[10mm] pb-[8mm] sm:px-[14mm]">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
            <Image src="/brand/nb-logo.png" alt="Noorcom Branding: Design, Print, Brand" width={578} height={440} priority className="h-28 w-auto" />
            <div className="text-right">
              <h1 className="font-sans text-4xl font-extrabold tracking-tight text-heading sm:text-5xl">{title}</h1>
              <p className="mt-1 text-lg text-muted"># {number}</p>
              <p className="mt-5 text-xs tracking-[0.12em] text-muted uppercase">{highlight.label}</p>
              <p className="text-2xl font-extrabold text-heading">{highlight.value}</p>
            </div>
          </header>

          {children}

          <footer className="mt-auto border-t border-border pt-4 text-center text-xs text-muted">
            <p>
              {invoiceIssuer.legalName} · {invoiceIssuer.tagline} · {site.phone} · {site.email}
            </p>
            <p className="mt-2 flex justify-between gap-4">
              <span>This is a computer-generated document.</span>
              <span>Page 1 of 1</span>
            </p>
          </footer>
        </div>
      </article>
    </div>
  );
}

/** A small red heading, as on the template ("FROM", "BILL TO", …). */
export function DocLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium tracking-[0.08em] text-accent-ink uppercase">{children}</p>;
}

/** The "From" block: the issuing company. */
export function IssuerBlock() {
  return (
    <div>
      <DocLabel>From</DocLabel>
      <p className="mt-2 text-base font-bold text-heading">{invoiceIssuer.legalName}</p>
      <p className="text-muted">{invoiceIssuer.addressLine}</p>
      <p className="text-muted">Tel: {site.phone}</p>
      <p className="break-all text-muted">{site.email}</p>
    </div>
  );
}

/** KES amounts with two decimals, as on the template: 90,000.00. */
export const money = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
