import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  BrandDocument,
  DocMeta,
  DocParties,
  money,
  PartyBlock,
  Th,
  Totals,
} from "@/components/order/BrandDocument";
import { formatDateShort } from "@/lib/calendar";
import { localPhone } from "@/lib/order-status";
import { invoiceIssuer } from "@/lib/site";
import { loadOrder, tokenFrom, withToken } from "../../load";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ ref: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const nairobiDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(
    new Date(iso),
  );

/**
 * The order's invoice, laid out after Noorcom's invoice design (16 Oct 2026): logo and the light
 * INVOICE with the balance due, the customer in a shaded box beside the dates, the items table
 * with its dark header, how to pay, and the totals ending on the shaded Balance Due band. Print or
 * save as PDF from the browser.
 */
export default async function InvoicePage({ params, searchParams }: Props) {
  const token = tokenFrom(await searchParams);
  const { order, ref } = await loadOrder((await params).ref, token);
  if (!order) redirect(`/order/${encodeURIComponent(ref)}`);

  const e = order.estimate;
  const total = order.total ?? e.dueNow.amount;
  const balance = Math.max(0, total - order.amountPaid);
  const date = formatDateShort(nairobiDate(order.createdAt));
  const quote = order.siteQuote?.status === "accepted" ? order.siteQuote : null;
  const terms =
    order.mechanism === "B"
      ? quote
        ? "50% now, balance at sign-off"
        : "Survey fee on receipt"
      : e.dueNow.purpose === "deposit"
        ? "50% deposit, balance on proof"
        : "Due on receipt";
  const rows = quote
    ? quote.lines.map((l) => ({
        item: l.label,
        description: l.detail ?? "",
        quantity: l.quantity ?? 1,
        unit: "",
        unitPrice: l.unitPrice ?? l.amount,
        amount: l.amount,
      }))
    : [
        ...e.lines.map((l, i) => ({
          item: l.label,
          description:
            i === 0
              ? order.needsDesign && order.mechanism === "A"
                ? `Order ${order.ref}, designed by our studio`
                : `Order ${order.ref}`
              : (l.detail ?? ""),
          quantity: l.quantity ?? 1,
          unit: l.quantity && order.mechanism === "A" && i === 0 ? "pcs" : "",
          unitPrice: l.unitPrice ?? l.amount,
          amount: l.amount,
        })),
        ...(e.urgency.amount
          ? [
              {
                item: `${e.urgency.label} deadline`,
                description: `${Math.round((e.urgency.multiplier - 1) * 100)}% on the order`,
                quantity: 1,
                unit: "",
                unitPrice: e.urgency.amount,
                amount: e.urgency.amount,
              },
            ]
          : []),
        ...(e.handoverFee
          ? [
              {
                item: "Delivery",
                description:
                  order.handover.method === "delivery"
                    ? order.handover.address
                    : "",
                quantity: 1,
                unit: "",
                unitPrice: e.handoverFee,
                amount: e.handoverFee,
              },
            ]
          : []),
      ];

  return (
    <BrandDocument
      backHref={withToken(`/order/${order.ref}`, token)}
      backLabel={`Back to order ${order.ref}`}
      label={`Invoice ${order.invoiceNo}`}
      title="INVOICE"
      number={order.invoiceNo}
      highlight={{ label: "Balance due", value: `KES ${money(balance)}` }}
    >
      <DocParties>
        <PartyBlock
          label="Bill to"
          name={order.company?.name ?? order.customer.name}
          lines={[
            order.company
              ? `Attn. ${order.customer.name}`
              : order.customer.company,
            order.customer.email,
            localPhone(order.customer.phone),
          ]}
        />
        <DocMeta
          rows={[
            ["Invoice Date", date],
            ["Order No.", order.ref],
            ...(order.company?.poNumber
              ? [["PO No.", order.company.poNumber] as [string, string]]
              : []),
            ["Terms", terms],
            ["Due Date", date],
          ]}
        />
      </DocParties>

      {/* Focusable so the keyboard can scroll it on narrow screens. */}
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Invoice items"
      >
        <table className="w-full min-w-[34rem] text-left">
          <thead>
            <tr className="bg-ink-hover text-xs text-bg uppercase">
              <Th>#</Th>
              <Th>Description</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Rate</Th>
              <Th align="right" last>
                Amount
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.item}-${i}`}
                className="break-inside-avoid border-b border-border align-top"
              >
                <td className="px-3 py-3 text-heading">{i + 1}</td>
                <td className="px-3 py-3">
                  <p className="text-sm text-heading">{r.item}</p>
                  {r.description && (
                    <p className="mt-0.5 text-xs text-muted">{r.description}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-sm text-heading tabular-nums">
                  {r.quantity.toLocaleString("en-KE")}
                  {r.unit && (
                    <span className="text-xs text-muted"> {r.unit}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-sm text-heading tabular-nums">
                  {money(r.unitPrice)}
                </td>
                <td className="px-3 py-3 text-right text-sm text-heading tabular-nums">
                  {money(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-8 pt-4 break-inside-avoid sm:grid-cols-[1fr_0.85fr] sm:gap-[18mm]">
        <div className="pt-2">
          <p className="text-sm text-heading italic">
            Thanks for your business.
          </p>
          <div className="mt-2 space-y-0.5 text-xs text-muted uppercase">
            <p>M-Pesa Paybill: {invoiceIssuer.paybill}</p>
            <p className="break-all">
              Account number: {invoiceIssuer.paybillAccount(order.ref)}
            </p>
            <p>
              {invoiceIssuer.bank} · {invoiceIssuer.accountName}
            </p>
          </div>
          {balance > 0 && (
            <a
              href={withToken(`/order/${order.ref}`, token)}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-accent-ink underline underline-offset-2 print:hidden"
            >
              Pay online: click here
            </a>
          )}
          <p className="mt-3 text-xs text-muted">
            {e.dueNow.purpose === "deposit"
              ? "A 50% deposit starts your order; the balance is due after you approve the proof, before printing."
              : "Payment is due on receipt of this invoice."}{" "}
            Please quote <span className="whitespace-nowrap">{order.ref}</span> as your payment reference.
          </p>
        </div>
        <Totals
          rows={[
            { label: "Sub Total", value: money(total) },
            { label: "Total", value: `KES ${money(total)}`, strong: true },
            ...(order.amountPaid
              ? [
                  {
                    label: "Amount Paid",
                    value: `(-) ${money(order.amountPaid)}`,
                  },
                ]
              : []),
            {
              label: "Balance Due",
              value: `KES ${money(balance)}`,
              band: true,
            },
          ]}
        />
      </div>
    </BrandDocument>
  );
}
