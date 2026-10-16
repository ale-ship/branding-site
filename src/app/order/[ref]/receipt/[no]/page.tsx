import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandDocument, DocMeta, DocParties, money, PartyBlock, Th, Totals } from '@/components/order/BrandDocument';
import { formatDateShort } from '@/lib/calendar';
import { localPhone, PURPOSE_LABEL } from '@/lib/order-status';
import { loadOrder, tokenFrom, withToken } from '../../../load';

export const metadata: Metadata = {
  title: 'Receipt',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ ref: string; no: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const nairobi = (iso: string) => {
  const d = new Date(iso);
  return {
    date: formatDateShort(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(d)),
    time: new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Nairobi',
    }).format(d),
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
      highlight={{
        label: 'Amount received',
        value: `KES ${money(payment.amount)}`,
      }}
    >
      <DocParties>
        <PartyBlock label="Received from" name={order.customer.name} lines={[order.customer.company, order.customer.email, localPhone(payment.phone ?? order.customer.phone)]} />
        <DocMeta
          rows={[
            ['Date', `${when.date}, ${when.time}`],
            ['Paid by', payment.method === 'stk' ? 'M-Pesa' : 'M-Pesa Paybill'],
            [
              'M-Pesa ref.',
              <span key="m" className="font-mono">
                {payment.mpesaReceipt}
              </span>,
            ],
            ['Invoice No.', order.invoiceNo],
            ['Order No.', order.ref],
          ]}
        />
      </DocParties>

      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Payment">
        <table className="w-full min-w-[28rem] text-left">
          <thead>
            <tr className="bg-ink-hover text-xs text-bg uppercase">
              <Th>#</Th>
              <Th>Description</Th>
              <Th align="right" last>
                Amount
              </Th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border align-top">
              <td className="px-3 py-3 text-heading">1</td>
              <td className="px-3 py-3">
                <p className="text-sm text-heading">{forWhat}</p>
                <p className="mt-0.5 text-xs text-muted">Against invoice {order.invoiceNo}</p>
              </td>
              <td className="px-3 py-3 text-right text-sm text-heading tabular-nums">{money(payment.amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-8 pt-4 sm:grid-cols-[1fr_0.85fr] sm:gap-[18mm]">
        <div className="flex flex-col items-start gap-3 pt-2">
          <p className="text-sm text-heading italic">Thank you for your payment.</p>
          <p className="text-xs text-muted">
            This receipt confirms the payment above was received by M-Pesa.
            {remaining > 0 ? ` The balance of KES ${money(remaining)} is due after you approve the proof, before printing.` : ' Your order is fully paid.'}
          </p>
          <p className="border-2 border-accent-ink px-4 py-1.5 text-xl font-extrabold tracking-[0.2em] text-accent-ink" aria-label="Paid">
            PAID
          </p>
        </div>
        <Totals
          rows={[
            { label: 'Invoice total', value: money(total) },
            { label: 'This payment', value: money(payment.amount) },
            {
              label: 'Paid to date',
              value: `KES ${money(paidToDate)}`,
              strong: true,
            },
            {
              label: 'Balance due',
              value: `KES ${money(remaining)}`,
              band: true,
            },
          ]}
        />
      </div>
    </BrandDocument>
  );
}
