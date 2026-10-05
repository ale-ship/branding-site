import { FileText, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { DemoControls } from '@/components/order/DemoControls';
import { OrderLookup } from '@/components/order/OrderLookup';
import { PaymentPanel } from '@/components/order/PaymentPanel';
import { PriceSummary } from '@/components/order/PriceSummary';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/PrintMarks';
import { api, apiMode, type Order, type OrderAccess } from '@/lib/api';
import { formatDay } from '@/lib/calendar';
import { formatKes } from '@/lib/format';
import { describeBrief } from '@/lib/order';
import { CLOSED, localPhone, PAYMENT_STATUS_LABEL, PURPOSE_LABEL, STATUS_LABEL, TRACKS, trackIndex } from '@/lib/order-status';
import { DELIVERY_ZONES } from '@/lib/pricing';
import { invoiceIssuer, site } from '@/lib/site';
import { accessCookie, parseAccess } from '../access';

export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } };

type Props = { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' }).format(new Date(iso));

/** One line on what happens now, by status. */
function nextStep(order: Order): string {
  switch (order.status) {
    case 'awaiting_payment':
      return order.mechanism === 'B' ? 'Pay the survey fee to book your site survey.' : 'Pay to start: we begin as soon as M-Pesa confirms.';
    case 'in_design':
      if (order.mechanism === 'B') return order.survey?.booked ? `Your survey is booked for ${formatDay(order.survey.booked)}.` : 'We’ll confirm your survey date on WhatsApp.';
      return order.needsDesign ? 'Our designer is working on your proof.' : 'We’re checking your artwork files.';
    case 'awaiting_approval':
      return 'Your proof is ready. We’ve sent it on WhatsApp and by email; approving here comes soon.';
    case 'awaiting_balance':
      return 'Proof approved. Pay the balance and printing starts.';
    case 'in_production':
      return 'In production. We update this page as work is done.';
    case 'ready':
      return 'Checked and packed.';
    case 'out_for_handover':
      if (order.mechanism === 'C') return 'Your final files are ready to download.';
      return order.handover.method === 'delivery' ? 'On its way to you.' : 'Ready for pickup at Chuka Elimu Plaza, Loita Street.';
    case 'completed':
      return 'Done. Thank you for ordering with us.';
    case 'expired':
      return `This order wasn’t paid within 48 hours, so it has closed.`;
    case 'on_hold':
      return 'On hold while we wait for your reply.';
    case 'cancelled':
      return 'This order was cancelled.';
  }
}

function handoverText(order: Order): string {
  const h = order.handover;
  if (h.method === 'pickup') return 'Collect from Chuka Elimu Plaza, 1st Floor, Loita Street';
  if (h.method === 'delivery') return `Delivery, ${DELIVERY_ZONES.find((z) => z.zone === h.zone)?.label ?? ''}: ${h.address}`;
  if (h.method === 'install') return `Installed on site: ${h.address}`;
  return 'Digital files, on this page and by email';
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { ref: rawRef } = await params;
  const ref = decodeURIComponent(rawRef).toUpperCase();
  const query = await searchParams;
  const token = typeof query.t === 'string' ? query.t : '';
  const access: OrderAccess | null = token ? { token } : parseAccess((await cookies()).get(accessCookie(ref))?.value);
  const order = access ? await api.getOrder(ref, access) : null;

  if (!order) {
    return (
      <Container className="grid grid-cols-1 gap-10 py-16 sm:py-24 lg:grid-cols-2">
        <div>
          <Eyebrow>Your order</Eyebrow>
          <h1 className="mt-4 text-[clamp(2.25rem,5vw,4rem)] leading-[1] font-extrabold">Find your order</h1>
          <p className="mt-4 max-w-md text-lg text-body">Enter your order number and the phone you ordered with. Your link is also in the WhatsApp message and email we sent.</p>
        </div>
        <div className="bg-paper p-6 sm:p-8">
          <OrderLookup initialRef={/^NB-\d{6}$/.test(ref) ? ref : ''} />
        </div>
      </Container>
    );
  }

  const product = await api.getOrderProduct(order.product.slug);
  const track = TRACKS[order.mechanism];
  const at = trackIndex(order.mechanism, order.status);
  const closed = CLOSED.includes(order.status);
  const pendingPayment = order.payments.find((p) => p.status === 'pending') ?? null;
  const canPay = (order.status === 'awaiting_payment' || order.status === 'awaiting_balance') && order.dueNow > 0;
  const p = order.progress;
  const percent = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const briefRows = product ? describeBrief(product.brief, order.brief) : [];

  return (
    <>
      <Container className="pt-10 pb-8 sm:pt-16">
        <Eyebrow>Order {order.ref}</Eyebrow>
        <h1 className="mt-4 text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em]">{order.product.name}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className={`inline-flex min-h-8 items-center px-3 text-sm font-semibold ${closed && order.status !== 'completed' ? 'bg-panel text-heading' : 'bg-ink text-bg'}`}>{STATUS_LABEL[order.status]}</span>
          <span className="text-body">{nextStep(order)}</span>
        </div>
        <p className="mt-3 text-sm text-muted">
          Placed {when(order.createdAt)} · {order.mechanism === 'A' ? `${order.quantity.toLocaleString('en-KE')} pieces` : order.mechanism === 'B' ? 'Site job' : 'Design'}
          {order.expiresAt && ` · pay by ${when(order.expiresAt)}`}
        </p>
      </Container>

      <Container className="grid grid-cols-1 gap-12 pb-20 sm:pb-28 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col gap-10">
          {canPay && (
            <PaymentPanel
              orderRef={order.ref}
              token={token}
              amount={order.dueNow}
              label={order.duePurpose ? PURPOSE_LABEL[order.duePurpose] : 'Payment'}
              defaultPhone={localPhone(order.customer.phone)}
              pending={pendingPayment}
              paybill={{ number: invoiceIssuer.paybill, account: invoiceIssuer.accountNo }}
              isMock={apiMode === 'mock'}
            />
          )}

          {order.status === 'expired' && (
            <p className="bg-paper p-5 text-body">
              Still need it?{' '}
              <Link href={`/order/new?product=${order.product.slug}`} className="font-semibold text-link underline">
                Start a new order
              </Link>{' '}
              or WhatsApp us.
            </p>
          )}

          <section aria-labelledby="progress-title">
            <h2 id="progress-title" className="text-2xl font-bold">
              Progress
            </h2>
            <ol className="mt-5 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
              {track.map((step, i) => {
                const done = at > i || order.status === 'completed';
                const current = at === i && order.status !== 'completed';
                return (
                  <li key={step.label} aria-current={current ? 'step' : undefined} className={`flex items-center gap-3 px-4 py-3 ${current ? 'bg-paper' : 'bg-bg'}`}>
                    <span
                      aria-hidden
                      className={`grid size-6 shrink-0 place-items-center rounded-pill text-xs font-bold ${done ? 'bg-ink text-bg' : current ? 'bg-accent text-ink' : 'border border-border-strong text-muted'}`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span className={done || current ? 'font-semibold text-heading' : 'text-muted'}>{step.label}</span>
                    <span className="sr-only">{done ? '(done)' : current ? '(now)' : '(to come)'}</span>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6">
              <p className="flex justify-between text-sm text-heading">
                <span className="font-semibold">
                  {p.kind === 'pieces' && `Pieces: ${p.done.toLocaleString('en-KE')} of ${p.total.toLocaleString('en-KE')}`}
                  {p.kind === 'stages' && `Stages: ${p.done} of ${p.total}`}
                  {p.kind === 'rounds' && `Revision rounds used: ${p.done} of ${p.total}`}
                </span>
                <span className="tabular-nums">{percent}%</span>
              </p>
              <div className="mt-2 h-2 bg-panel" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done} aria-label="Progress">
                <div className="h-full bg-accent" style={{ width: `${Math.min(100, percent)}%` }} />
              </div>
              {p.kind === 'stages' && (
                <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                  {p.stages.map((s) => (
                    <li key={s.name} className={s.done ? 'text-heading' : 'text-muted'}>
                      {s.done ? '✓ ' : '○ '}
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
              {order.estimate.readyBy && !closed && (
                <p className="mt-4 text-sm text-body">
                  Ready by about <strong className="text-heading">{formatDay(order.estimate.readyBy)}</strong> if the proof is approved on time; dates count from approval.
                </p>
              )}
            </div>
          </section>

          {order.survey && (
            <section aria-labelledby="survey-title" className="bg-paper p-5">
              <h2 id="survey-title" className="text-xl font-bold">
                Site survey
              </h2>
              <p className="mt-2 text-body">
                {order.survey.booked
                  ? `Booked for ${formatDay(order.survey.booked)}.`
                  : `Your preferred dates: ${order.survey.preferred.map(formatDay).join(' or ') || 'not given'}. We confirm one on WhatsApp.`}
              </p>
            </section>
          )}

          <section aria-labelledby="payments-title">
            <h2 id="payments-title" className="text-2xl font-bold">
              Payments
            </h2>
            {order.payments.length ? (
              <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Payments">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink text-xs tracking-[0.12em] text-muted uppercase">
                      <th scope="col" className="py-2 pr-4 font-semibold">For</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">How</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Receipt</th>
                      <th scope="col" className="py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.payments.map((pay) => (
                      <tr key={pay.id} className="border-b border-border">
                        <td className="py-3 pr-4 text-heading">{PURPOSE_LABEL[pay.purpose]}</td>
                        <td className="py-3 pr-4 text-body">{pay.method === 'stk' ? 'M-Pesa prompt' : 'Paybill'}</td>
                        <td className="py-3 pr-4 text-body">{PAYMENT_STATUS_LABEL[pay.status]}</td>
                        <td className="py-3 pr-4 font-mono text-body">{pay.mpesaReceipt ?? '—'}</td>
                        <td className="py-3 text-right text-heading tabular-nums">{formatKes(pay.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-body">No payments yet.</p>
            )}
            <p className="mt-3 text-sm text-body">
              Paid <strong className="text-heading">{formatKes(order.amountPaid)}</strong>
              {order.total !== null && <> of {formatKes(order.total)}</>}
              {order.credit > 0 && <> · credit {formatKes(order.credit)}</>}
            </p>
          </section>

          <section aria-labelledby="details-title">
            <h2 id="details-title" className="text-2xl font-bold">
              Your order
            </h2>
            <dl className="mt-4 border-t border-ink">
              {[
                ...(order.mechanism === 'A' ? [{ label: 'Quantity', value: `${order.quantity.toLocaleString('en-KE')} pieces` }] : []),
                ...briefRows,
                { label: 'Artwork', value: order.needsDesign ? 'Designed by our studio' : 'Your print-ready files' },
                ...(order.common.colours.length ? [{ label: 'Brand colours', value: order.common.colours.join(', ') }] : []),
                ...(order.common.text ? [{ label: 'Words to appear', value: order.common.text }] : []),
                ...(order.common.assets.length ? [{ label: 'Files', value: order.common.assets.map((f) => f.name).join(', ') }] : []),
                { label: 'Deadline', value: order.estimate.urgency.label },
                { label: 'Handover', value: handoverText(order) },
                { label: 'Contact', value: `${order.customer.name}${order.customer.company ? `, ${order.customer.company}` : ''} · ${localPhone(order.customer.phone)} · ${order.customer.email}` },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-1 gap-1 border-b border-border py-3 sm:grid-cols-[11rem_1fr] sm:gap-6">
                  <dt className="text-sm font-semibold text-muted">{row.label}</dt>
                  <dd className="break-words text-heading">{row.value}</dd>
                </div>
              ))}
            </dl>
            {order.common.assets.length > 0 && (
              // TODO(backend): real uploads; until then only file names travel.
              <p className="mt-3 text-sm text-muted">Please send the files themselves on WhatsApp or by email, quoting {order.ref}.</p>
            )}
          </section>

          <section aria-labelledby="history-title" className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div>
              <h2 id="history-title" className="text-xl font-bold">
                History
              </h2>
              <ol className="mt-4 flex flex-col gap-3 border-l border-border-strong pl-4">
                {[...order.events].reverse().map((e, i) => (
                  <li key={`${e.at}-${i}`}>
                    <p className="text-heading">{e.text}</p>
                    <p className="text-xs text-muted">{when(e.at)}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="text-xl font-bold">Messages we sent</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {[...order.notifications].reverse().map((n, i) => (
                  <li key={`${n.at}-${n.channel}-${i}`} className="text-sm">
                    <p className="text-heading">{n.text}</p>
                    <p className="text-xs text-muted">
                      {n.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} · {when(n.at)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {apiMode === 'mock' && <DemoControls orderRef={order.ref} token={token} status={order.status} />}
        </div>

        <aside aria-label="Order summary" className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          <div className="border border-border p-6">
            <PriceSummary estimate={order.estimate} heading="Price agreed" />
          </div>
          <Link
            href={`/order/${order.ref}/invoice${token ? `?t=${token}` : ''}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 border border-ink px-6 font-semibold text-ink transition-colors hover:bg-ink hover:text-bg"
          >
            <FileText aria-hidden className="size-4" />
            Invoice {order.invoiceNo}
          </Link>
          <a
            href={`${site.whatsappHref}?text=${encodeURIComponent(`Hello Noorcom, about my order ${order.ref}: `)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-whatsapp px-6 font-semibold text-bg transition-colors hover:bg-whatsapp-hover"
          >
            <MessageCircle aria-hidden className="size-4" />
            Ask about this order
          </a>
          <p className="text-sm text-muted">Keep this page’s link: it opens your order without signing in.</p>
        </aside>
      </Container>
    </>
  );
}
