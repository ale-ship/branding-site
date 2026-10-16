import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { invoiceIssuer, site } from '@/lib/site';
import { PrintButton } from './PrintButton';

/**
 * The frame shared by invoices, receipts and statements, after Noorcom's invoice design (16 Oct
 * 2026): A4, the logo on the left, the document's name in light capitals with its number and one
 * highlighted figure on the right, then the company in one line under a hairline. The page around
 * it (back link, print button) is hidden when printing.
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

      <article aria-label={label} className="print-exact mx-auto flex min-h-[297mm] max-w-[210mm] flex-col bg-bg font-sans text-[13px] text-body shadow-sm print:min-h-0 print:shadow-none">
        <div className="print-pad flex flex-1 flex-col px-[6mm] pt-[12mm] pb-[10mm] sm:px-[14mm] print:px-[14mm]">
          <header className="flex flex-wrap items-start justify-between gap-6">
            <Image src="/brand/nb-logo.png" alt="Noorcom Branding: Design, Print, Brand" width={578} height={440} loading="eager" className="h-24 w-auto" />
            <div className="ml-auto text-right">
              <h1 className="font-sans text-4xl font-light tracking-wide text-heading sm:text-[2.75rem]">{title}</h1>
              <p className="mt-1 text-base text-heading"># {number}</p>
              <p className="mt-6 text-xs text-muted uppercase">{highlight.label}</p>
              <p className="text-2xl font-bold text-heading tabular-nums">{highlight.value}</p>
            </div>
          </header>

          <div className="mt-4 border-b border-border pb-3">
            <p className="text-base font-bold text-heading uppercase">{invoiceIssuer.legalName}</p>
            <p className="mt-0.5 text-muted">
              {invoiceIssuer.addressLine} · {site.phone} · {site.email}
            </p>
          </div>

          {children}
        </div>
      </article>
    </div>
  );
}

/** Who the document is for: the name in a shaded box, then the rest in small grey lines. */
export function PartyBlock({ label, name, lines }: { label: string; name: string; lines: (string | null | undefined | false)[] }) {
  return (
    <div className="min-w-0">
      <p className="sr-only">{label}</p>
      <p className="border border-border-strong bg-panel px-3 py-1.5 text-center text-[15px] font-bold text-heading">{name}</p>
      <div className="mt-2 space-y-0.5 text-muted">
        {lines.filter(Boolean).map((l) => (
          <p key={String(l)} className="break-all">
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}

/** The document's dates and numbers: "Invoice Date :" on the left, the value in bold on the right. */
export function DocMeta({ rows, children }: { rows: [string, ReactNode][]; children?: ReactNode }) {
  return (
    <div>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-6 border-b border-border py-1.5">
            <dt className="whitespace-nowrap text-heading">{k} :</dt>
            <dd className="text-right font-bold text-heading">{v}</dd>
          </div>
        ))}
      </dl>
      {children}
    </div>
  );
}

/** The two columns under the header: the party on the left, the details on the right. */
export function DocParties({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-6 py-5 sm:grid-cols-[1fr_0.85fr] sm:gap-[18mm]">{children}</div>;
}

/** The items table's dark header cell; the last (amount) column is darker still. */
export function Th({ children, align = 'left', last = false }: { children: ReactNode; align?: 'left' | 'right'; last?: boolean }) {
  return (
    <th scope="col" className={`px-3 py-2.5 font-bold ${align === 'right' ? 'text-right' : ''} ${last ? 'bg-ink' : ''}`}>
      {children}
    </th>
  );
}

/** The totals on the right: hairline rows, the total larger, the balance on a shaded band. */
export function Totals({ rows }: { rows: { label: string; value: string; strong?: boolean; band?: boolean }[] }) {
  return (
    <dl className="flex flex-col self-start border-t-2 border-border">
      {rows.map((r) => (
        <div
          key={r.label}
          className={`flex justify-between gap-4 px-1 ${r.band ? 'mt-1 bg-panel px-3 py-2.5 text-lg font-bold text-heading' : `border-b border-border py-2 ${r.strong ? 'text-lg font-bold text-heading' : 'text-heading'}`}`}
        >
          <dt className="whitespace-nowrap">{r.label}</dt>
          <dd className="whitespace-nowrap tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** KES amounts with two decimals, as on the template: 90,000.00. */
export const money = (n: number) =>
  n.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
