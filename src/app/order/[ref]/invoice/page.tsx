import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PrintButton } from '@/components/order/PrintButton';
import { api, type OrderAccess } from '@/lib/api';
import { formatDateShort } from '@/lib/calendar';
import { localPhone } from '@/lib/order-status';
import { invoiceIssuer, site } from '@/lib/site';
import { shillingsInWords } from '@/lib/words';
import { accessCookie, parseAccess } from '../../access';

export const metadata: Metadata = { title: 'Invoice', robots: { index: false, follow: false } };

type Props = { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const money = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nairobiDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date(iso));

/**
 * The order's invoice, laid out after Noorcom's own template (INV00870, 5 Oct 2026): logo, the big
 * INVOICE and balance due, From / Bill to / Invoice details, the items table, amount in words,
 * payment details and the red Balance due bar. Print or save as PDF from the browser.
 */
export default async function InvoicePage({ params, searchParams }: Props) {
  const { ref: rawRef } = await params;
  const ref = decodeURIComponent(rawRef).toUpperCase();
  const token = typeof (await searchParams).t === 'string' ? ((await searchParams).t as string) : '';
  const access: OrderAccess | null = token ? { token } : parseAccess((await cookies()).get(accessCookie(ref))?.value);
  const order = access ? await api.getOrder(ref, access) : null;
  if (!order) redirect(`/order/${encodeURIComponent(ref)}`);

  const e = order.estimate;
  const total = order.total ?? e.dueNow.amount;
  const balance = Math.max(0, total - order.amountPaid);
  const date = formatDateShort(nairobiDate(order.createdAt));
  const terms =
    order.mechanism === 'B'
      ? 'Survey fee due on receipt; credited to your final bill'
      : e.dueNow.purpose === 'deposit'
        ? '50% deposit on receipt; balance after proof approval'
        : 'Due on receipt';
  const rows = [
    ...e.lines.map((l, i) => ({
      item: l.label,
      description: i === 0 ? (order.needsDesign && order.mechanism === 'A' ? `Design and printing of ${l.label.toLowerCase()}` : `Order ${order.ref}`) : (l.detail ?? ''),
      quantity: l.quantity ?? 1,
      unit: l.quantity && order.mechanism === 'A' && i === 0 ? 'pcs' : '',
      unitPrice: l.unitPrice ?? l.amount,
      amount: l.amount,
    })),
    ...(e.urgency.amount
      ? [{ item: `${e.urgency.label} deadline`, description: `${Math.round((e.urgency.multiplier - 1) * 100)}% on the order`, quantity: 1, unit: '', unitPrice: e.urgency.amount, amount: e.urgency.amount }]
      : []),
    ...(e.handoverFee ? [{ item: 'Delivery', description: order.handover.method === 'delivery' ? order.handover.address : '', quantity: 1, unit: '', unitPrice: e.handoverFee, amount: e.handoverFee }] : []),
  ];

  return (
    <div className="bg-panel py-8 print:bg-bg print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-4 px-4 print:hidden">
        <Link href={`/order/${order.ref}${token ? `?t=${token}` : ''}`} className="inline-flex min-h-11 items-center font-semibold text-heading underline underline-offset-4">
          Back to order {order.ref}
        </Link>
        <PrintButton />
      </div>

      <article aria-label={`Invoice ${order.invoiceNo}`} className="mx-auto flex min-h-[297mm] max-w-[210mm] flex-col bg-bg text-[13px] text-body shadow-sm print:min-h-0 print:shadow-none">
        <div className="h-2 bg-brand-red" />
        <div className="flex flex-1 flex-col px-[14mm] pt-[10mm] pb-[8mm]">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
            <Image src="/brand/nb-logo.png" alt="Noorcom Branding: Design, Print, Brand" width={578} height={440} priority className="h-28 w-auto" />
            <div className="text-right">
              <h1 className="font-sans text-5xl font-extrabold tracking-tight text-heading">INVOICE</h1>
              <p className="mt-1 text-lg text-muted"># {order.invoiceNo}</p>
              <p className="mt-5 text-xs tracking-[0.12em] text-muted uppercase">Balance due</p>
              <p className="text-2xl font-extrabold text-heading">KES {money(balance)}</p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium tracking-[0.08em] text-brand-red-ink uppercase">From</p>
              <p className="mt-2 text-base font-bold text-heading">{invoiceIssuer.legalName}</p>
              <p className="text-muted">{invoiceIssuer.addressLine}</p>
              <p className="text-muted">Tel: {site.phone}</p>
              <p className="break-all text-muted">{site.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-[0.08em] text-brand-red-ink uppercase">Bill to</p>
              <p className="mt-2 text-base font-bold text-heading">{order.customer.name}</p>
              {order.customer.company && <p className="text-muted">{order.customer.company}</p>}
              <p className="text-muted">{localPhone(order.customer.phone)}</p>
              <p className="break-all text-muted">{order.customer.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-[0.08em] text-brand-red-ink uppercase">Invoice details</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted">Invoice No.</dt>
                <dd className="text-right font-medium text-heading">{order.invoiceNo}</dd>
                <dt className="text-muted">Order No.</dt>
                <dd className="text-right font-medium text-heading">{order.ref}</dd>
                <dt className="text-muted">Invoice Date</dt>
                <dd className="text-right font-medium text-heading">{date}</dd>
                <dt className="text-muted">Terms</dt>
                <dd className="text-right font-medium text-heading">{terms}</dd>
                <dt className="text-muted">Due Date</dt>
                <dd className="text-right font-medium text-heading">{date}</dd>
              </dl>
            </div>
          </div>

          {/* Focusable so the keyboard can scroll it on narrow screens. */}
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Invoice items">
            <table className="w-full min-w-[34rem] border-b border-ink text-left">
              <thead>
                <tr className="bg-ink text-xs text-bg uppercase">
                  <th scope="col" className="px-4 py-3 font-medium">#</th>
                  <th scope="col" className="px-2 py-3 font-medium">Item &amp; description</th>
                  <th scope="col" className="px-2 py-3 text-right font-medium">Qty</th>
                  <th scope="col" className="px-2 py-3 text-right font-medium">Unit price (KES)</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Amount (KES)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.item}-${i}`} className="align-top">
                    <td className="px-4 py-3 text-heading">{i + 1}</td>
                    <td className="px-2 py-3">
                      <p className="text-[15px] text-heading">{r.item}</p>
                      {r.description && <p className="text-muted">{r.description}</p>}
                    </td>
                    <td className="px-2 py-3 text-right text-heading tabular-nums">
                      {r.quantity.toLocaleString('en-KE')} {r.unit && <span className="text-xs text-muted">{r.unit}</span>}
                    </td>
                    <td className="px-2 py-3 text-right text-heading tabular-nums">{money(r.unitPrice)}</td>
                    <td className="px-4 py-3 text-right text-heading tabular-nums">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-8 pt-6 sm:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-xs font-medium tracking-[0.08em] text-brand-red-ink uppercase">Amount in words</p>
                <p className="mt-1 text-[15px] text-heading italic">{shillingsInWords(total)}</p>
              </div>
              <div className="border-l-4 border-brand-red bg-paper px-5 py-4">
                <p className="text-xs font-medium tracking-[0.08em] text-brand-red-ink uppercase">Payment details</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                  <dt className="text-muted">M-Pesa</dt>
                  <dd className="font-medium text-heading">On your order page (prompt to your phone)</dd>
                  <dt className="text-muted">Bank</dt>
                  <dd className="font-medium text-heading">{invoiceIssuer.bank}</dd>
                  <dt className="text-muted">Account Name</dt>
                  <dd className="font-medium text-heading">{invoiceIssuer.accountName}</dd>
                  <dt className="text-muted">Paybill</dt>
                  <dd className="font-medium text-heading">{invoiceIssuer.paybill}</dd>
                  <dt className="text-muted">Account No.</dt>
                  <dd className="font-medium text-heading">{invoiceIssuer.accountNo}</dd>
                </dl>
                <p className="mt-2 text-xs text-muted">Please quote {order.ref} as your payment reference.</p>
              </div>
            </div>
            <dl className="flex flex-col self-start">
              <div className="flex justify-between border-b border-border py-2">
                <dt className="text-muted">Sub Total</dt>
                <dd className="text-heading tabular-nums">{money(total)}</dd>
              </div>
              <div className="flex justify-between border-b border-border py-2">
                <dt className="font-bold text-heading">Total</dt>
                <dd className="font-bold text-heading tabular-nums">KES {money(total)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Amount Paid</dt>
                <dd className="text-heading tabular-nums">{money(order.amountPaid)}</dd>
              </div>
              <div className="flex justify-between bg-brand-red-ink px-4 py-3 text-bg">
                <dt className="text-base font-bold">Balance Due</dt>
                <dd className="text-base font-bold tabular-nums">KES {money(balance)}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-8">
            <p className="text-xs font-medium tracking-[0.08em] text-brand-red-ink uppercase">Notes</p>
            <p className="mt-1 text-muted">
              Thank you for your business.{' '}
              {e.dueNow.purpose === 'deposit'
                ? 'A 50% deposit starts your order; the balance is due after you approve the proof, before printing.'
                : 'Payment is due on receipt of this invoice.'}
            </p>
          </div>

          <footer className="mt-auto border-t border-border pt-4 text-center text-xs text-muted">
            <p>
              {invoiceIssuer.legalName} · {invoiceIssuer.tagline} · {site.phone} · {site.email}
            </p>
            <p className="mt-2 flex justify-between">
              <span>This is a computer-generated invoice.</span>
              <span>Page 1 of 1</span>
            </p>
          </footer>
        </div>
      </article>
    </div>
  );
}
