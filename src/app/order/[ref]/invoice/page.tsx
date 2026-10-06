import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandDocument, DocLabel, IssuerBlock, money } from '@/components/order/BrandDocument';
import { formatDateShort } from '@/lib/calendar';
import { localPhone } from '@/lib/order-status';
import { invoiceIssuer } from '@/lib/site';
import { shillingsInWords } from '@/lib/words';
import { loadOrder, tokenFrom, withToken } from '../../load';

export const metadata: Metadata = { title: 'Invoice', robots: { index: false, follow: false } };

type Props = { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const nairobiDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date(iso));

/**
 * The order's invoice, laid out after Noorcom's own template (5 Oct 2026): logo, the big INVOICE
 * and balance due, From / Bill to / Invoice details, the items table, amount in words, payment
 * details and the red Balance due bar. Print or save as PDF from the browser.
 */
export default async function InvoicePage({ params, searchParams }: Props) {
  const token = tokenFrom(await searchParams);
  const { order, ref } = await loadOrder((await params).ref, token);
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
    <BrandDocument
      backHref={withToken(`/order/${order.ref}`, token)}
      backLabel={`Back to order ${order.ref}`}
      label={`Invoice ${order.invoiceNo}`}
      title="INVOICE"
      number={order.invoiceNo}
      highlight={{ label: 'Balance due', value: `KES ${money(balance)}` }}
    >
      <div className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-3">
        <IssuerBlock />
        <div>
          <DocLabel>Bill to</DocLabel>
          <p className="mt-2 text-base font-bold text-heading">{order.customer.name}</p>
          {order.customer.company && <p className="text-muted">{order.customer.company}</p>}
          <p className="text-muted">{localPhone(order.customer.phone)}</p>
          <p className="break-all text-muted">{order.customer.email}</p>
        </div>
        <div>
          <DocLabel>Invoice details</DocLabel>
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
            <DocLabel>Amount in words</DocLabel>
            <p className="mt-1 text-[15px] text-heading italic">{shillingsInWords(total)}</p>
          </div>
          <PaymentDetails reference={order.ref} />
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
          <div className="flex justify-between bg-accent px-4 py-3 text-on-accent">
            <dt className="text-base font-bold">Balance Due</dt>
            <dd className="text-base font-bold tabular-nums">KES {money(balance)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 mb-8">
        <DocLabel>Notes</DocLabel>
        <p className="mt-1 text-muted">
          Thank you for your business.{' '}
          {e.dueNow.purpose === 'deposit'
            ? 'A 50% deposit starts your order; the balance is due after you approve the proof, before printing.'
            : 'Payment is due on receipt of this invoice.'}
        </p>
      </div>
    </BrandDocument>
  );
}

/** How to pay: M-Pesa on the order page, or Absa's Paybill with the order number. */
function PaymentDetails({ reference }: { reference: string }) {
  return (
    <div className="border-l-4 border-brand-red bg-paper px-5 py-4">
      <DocLabel>Payment details</DocLabel>
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
        <dd className="font-medium break-all text-heading">{invoiceIssuer.paybillAccount(reference)}</dd>
      </dl>
      <p className="mt-2 text-xs text-muted">Please quote {reference} as your payment reference.</p>
    </div>
  );
}
