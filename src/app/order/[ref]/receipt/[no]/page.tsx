import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandDocument, DocLabel, IssuerBlock, money } from '@/components/order/BrandDocument';
import { formatDateShort } from '@/lib/calendar';
import { localPhone, PURPOSE_LABEL } from '@/lib/order-status';
import { shillingsInWords } from '@/lib/words';
import { loadOrder, tokenFrom, withToken } from '../../../load';

export const metadata: Metadata = { title: 'Receipt', robots: { index: false, follow: false } };

type Props = { params: Promise<{ ref: string; no: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const nairobi = (iso: string) => {
  const d = new Date(iso);
  return {
    date: formatDateShort(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(d)),
    time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' }).format(d),
  };
};

/**
 * A payment receipt, one per confirmed payment (owner, 6 Oct 2026), in the same frame as the
 * invoice: receipt and M-Pesa numbers, what it paid for, and what's left to pay after it.
 */
export default async function ReceiptPage({ params, searchParams }: Props) {
  const { ref: rawRef, no } = await params;
  const token = tokenFrom(await searchParams);
  const { order, ref } = await loadOrder(rawRef, token);
  if (!order) redirect(`/order/${encodeURIComponent(ref)}`);
  const receiptNo = decodeURIComponent(no).toUpperCase();
  const payment = order.payments.find((p) => p.receiptNo === receiptNo && p.status === 'confirmed');
  if (!payment || !payment.settledAt) redirect(withToken(`/order/${order.ref}`, token));

  // Paid so far, up to and including this payment, in the order they were confirmed.
  const confirmed = order.payments.filter((p) => p.status === 'confirmed' && p.settledAt).sort((a, b) => a.settledAt!.localeCompare(b.settledAt!));
  const paidToDate = confirmed.slice(0, confirmed.indexOf(payment) + 1).reduce((s, p) => s + p.amount, 0);
  const total = order.total ?? order.estimate.dueNow.amount;
  const remaining = Math.max(0, total - paidToDate);
  const when = nairobi(payment.settledAt);
  const forWhat = `${PURPOSE_LABEL[payment.purpose]} for ${order.product.name}${order.mechanism === 'A' ? `, ${order.quantity.toLocaleString('en-KE')} pieces` : ''}`;

  return (
    <BrandDocument
      backHref={withToken(`/order/${order.ref}`, token)}
      backLabel={`Back to order ${order.ref}`}
      label={`Receipt ${receiptNo}`}
      title="RECEIPT"
      number={receiptNo}
      highlight={{ label: 'Amount received', value: `KES ${money(payment.amount)}` }}
    >
      <div className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-3">
        <IssuerBlock />
        <div>
          <DocLabel>Received from</DocLabel>
          <p className="mt-2 text-base font-bold text-heading">{order.customer.name}</p>
          {order.customer.company && <p className="text-muted">{order.customer.company}</p>}
          <p className="text-muted">{localPhone(payment.phone ?? order.customer.phone)}</p>
          <p className="break-all text-muted">{order.customer.email}</p>
        </div>
        <div>
          <DocLabel>Receipt details</DocLabel>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Receipt No.</dt>
            <dd className="text-right font-medium text-heading">{receiptNo}</dd>
            <dt className="text-muted">Date</dt>
            <dd className="text-right font-medium text-heading">
              {when.date}, {when.time}
            </dd>
            <dt className="text-muted">Paid by</dt>
            <dd className="text-right font-medium text-heading">{payment.method === 'stk' ? 'M-Pesa' : 'M-Pesa Paybill'}</dd>
            <dt className="text-muted">M-Pesa ref.</dt>
            <dd className="text-right font-mono font-medium text-heading">{payment.mpesaReceipt}</dd>
            <dt className="text-muted">Invoice No.</dt>
            <dd className="text-right font-medium text-heading">{order.invoiceNo}</dd>
            <dt className="text-muted">Order No.</dt>
            <dd className="text-right font-medium text-heading">{order.ref}</dd>
          </dl>
        </div>
      </div>

      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Payment">
        <table className="w-full min-w-[28rem] border-b border-ink text-left">
          <thead>
            <tr className="bg-ink text-xs text-bg uppercase">
              <th scope="col" className="px-4 py-3 font-medium">#</th>
              <th scope="col" className="px-2 py-3 font-medium">Description</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Amount (KES)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="px-4 py-3 text-heading">1</td>
              <td className="px-2 py-3">
                <p className="text-[15px] text-heading">{forWhat}</p>
                <p className="text-muted">Against invoice {order.invoiceNo}</p>
              </td>
              <td className="px-4 py-3 text-right text-heading tabular-nums">{money(payment.amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-8 pt-6 sm:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          <div>
            <DocLabel>Amount in words</DocLabel>
            <p className="mt-1 text-[15px] text-heading italic">{shillingsInWords(payment.amount)}</p>
          </div>
          <p className="self-start border-2 border-accent-ink px-4 py-2 text-2xl font-extrabold tracking-[0.2em] text-accent-ink" aria-label="Paid">
            PAID
          </p>
        </div>
        <dl className="flex flex-col self-start">
          <div className="flex justify-between border-b border-border py-2">
            <dt className="text-muted">Invoice total</dt>
            <dd className="text-heading tabular-nums">{money(total)}</dd>
          </div>
          <div className="flex justify-between border-b border-border py-2">
            <dt className="text-muted">This payment</dt>
            <dd className="text-heading tabular-nums">{money(payment.amount)}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="font-bold text-heading">Paid to date</dt>
            <dd className="font-bold text-heading tabular-nums">KES {money(paidToDate)}</dd>
          </div>
          <div className="flex justify-between bg-ink px-4 py-3 text-bg">
            <dt className="text-base font-bold">Balance remaining</dt>
            <dd className="text-base font-bold tabular-nums">KES {money(remaining)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 mb-8">
        <DocLabel>Notes</DocLabel>
        <p className="mt-1 text-muted">
          Thank you. This receipt confirms the payment above was received by M-Pesa.
          {remaining > 0 ? ` The balance of KES ${money(remaining)} is due after you approve the proof, before printing.` : ' Your order is fully paid.'}
        </p>
      </div>
    </BrandDocument>
  );
}
