import { FileText, MessageCircle, Package, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoControls } from '@/components/order/DemoControls';
import { OrderLookup } from '@/components/order/OrderLookup';
import { PartialDeliveryForm } from '@/components/order/PartialDeliveryForm';
import { PaymentPanel } from '@/components/order/PaymentPanel';
import { PriceSummary } from '@/components/order/PriceSummary';
import { ProofVersion } from '@/components/order/ProofFigure';
import { ProofReview } from '@/components/order/ProofReview';
import { SampleReview } from '@/components/order/SampleReview';
import { AcceptQuote, InstallBooking, SurveyBooking } from '@/components/order/SiteJobPanels';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/PrintMarks';
import { api, apiMode, demo, ordersOnApi, type Order } from '@/lib/api';
import { addWorkingDays, formatDay } from '@/lib/calendar';
import { formatKes } from '@/lib/format';
import { describeBrief } from '@/lib/order';
import { CLOSED, localPhone, PAYMENT_STATUS_LABEL, PURPOSE_LABEL, STATUS_LABEL, TRACKS, orderTrackIndex } from '@/lib/order-status';
import { DELIVERY_ZONES } from '@/lib/pricing';
import { deliverablePieces, productionEta, SAMPLE_THRESHOLD } from '@/lib/production';
import { nairobiToday } from '@/lib/quote';
import { earliestInstall } from '@/lib/site-quote';
import { invoiceIssuer, site } from '@/lib/site';
import { loadOrder, tokenFrom, withToken } from '../load';

export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } };

type Props = { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' }).format(new Date(iso));

/** One line on what happens now, by status. */
function nextStep(order: Order): string {
  switch (order.status) {
    case 'awaiting_payment':
      if (order.mechanism === 'B') return order.duePurpose === 'deposit' ? 'Pay the deposit and the design starts.' : 'Pay the survey fee to book your site survey.';
      return 'Pay to start: we begin as soon as M-Pesa confirms.';
    case 'in_design':
      if (order.mechanism === 'B') {
        if (order.siteQuote?.status === 'accepted') return 'Deposit paid. Our designer is on your job.';
        if (order.siteQuote) return 'Your firm quote is ready: check it below.';
        return order.survey?.booked ? `Your survey is booked for ${formatDay(order.survey.booked)}.` : 'Choose the date for your site survey below.';
      }
      return order.needsDesign ? 'Our designer is working on your proof.' : 'We’re checking your artwork files.';
    case 'awaiting_approval':
      return 'Your proof is ready: check it below, then approve it or ask for changes.';
    case 'awaiting_balance':
      return order.mechanism === 'B' ? 'Installed and signed off. Pay the balance to close the job.' : 'Proof approved. Pay the balance and printing starts.';
    case 'in_production':
      if (order.mechanism === 'B') return order.installDate ? `Installation booked for ${formatDay(order.installDate)}.` : 'Materials are in production: choose your installation date below.';
      if (order.sample?.status === 'pending') return 'A printed sample is ready: check it below.';
      if (order.sample && order.sample.status !== 'approved') return 'We’re printing one sample for you to check before the full run.';
      return 'In production. We update this page as work is done.';
    case 'ready':
      return 'Checked and packed.';
    case 'out_for_handover':
      if (order.mechanism === 'C') return 'Your final files are ready to download.';
      return order.handover.method === 'delivery' ? 'On its way to you.' : 'Ready for pickup at Chuka Elimu Plaza, Loita Street: bring your pickup code.';
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
  const token = tokenFrom(await searchParams);
  const { order, ref } = await loadOrder((await params).ref, token);

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
  const at = orderTrackIndex(order);
  const closed = CLOSED.includes(order.status);
  const pendingPayment = order.payments.find((p) => p.status === 'pending') ?? null;
  const canPay = (order.status === 'awaiting_payment' || order.status === 'awaiting_balance') && order.dueNow > 0;
  const p = order.progress;
  const percent = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const briefRows = product ? describeBrief(product.brief, order.brief) : [];
  const today = nairobiToday();
  const reviewing = order.status === 'awaiting_approval' && order.proofs.at(-1)?.status === 'pending' ? order.proofs.at(-1)! : null;
  const pastProofs = [...order.proofs].filter((x) => x !== reviewing).reverse();
  const roundsNote =
    p.kind === 'rounds' ? `${Math.max(0, p.total - p.done)} of ${p.total} revision rounds left` : order.needsDesign ? null : 'File fixes only: one round included';
  const eta =
    p.kind === 'pieces' && order.status === 'in_production' && (!order.sample || order.sample.status === 'approved')
      ? productionEta(p.done, p.total, order.production.logs, order.production.dailyCapacity, today, order.production.promisedBy)
      : null;
  const earlyMax = p.kind === 'pieces' ? deliverablePieces(p.done, order.deliveries) : 0;
  const canAskEarly =
    order.mechanism === 'A' && order.status === 'in_production' && order.handover.method === 'delivery' && earlyMax > 0 && !order.deliveries.some((d) => d.status !== 'delivered');
  const showHandover = order.deliveries.length > 0 || !!order.pickupCode || !!order.handedOver || canAskEarly;

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
              paybill={{ number: invoiceIssuer.paybill, account: invoiceIssuer.paybillAccount(order.ref) }}
              isMock={apiMode === 'mock' && !ordersOnApi}
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

          {reviewing && <ProofReview orderRef={order.ref} token={token} proof={reviewing} productName={order.product.name} roundsNote={roundsNote} approvalNote={order.company ? `For ${order.company.name}, proofs are approved by ${order.company.approvers.join(' or ')}.` : undefined} />}

          {order.status === 'in_production' && order.sample?.status === 'pending' && order.sample.photo && (
            <SampleReview orderRef={order.ref} token={token} photo={order.sample.photo} productName={order.product.name} />
          )}

          {order.status === 'out_for_handover' && order.pickupCode && (
            <section aria-labelledby="pickup-title" className="border border-ink p-5 sm:p-6">
              <h2 id="pickup-title" className="text-xl font-bold">
                Your pickup code
              </h2>
              <p className="mt-3 font-display text-5xl font-extrabold tracking-[0.12em] text-heading tabular-nums">
                <span className="sr-only">{order.pickupCode.split('').join(' ')}</span>
                <span aria-hidden>
                  {order.pickupCode.slice(0, 3)} {order.pickupCode.slice(3)}
                </span>
              </p>
              <p className="mt-3 text-body">
                Show this code at the counter, Chuka Elimu Plaza, 1st Floor, Loita Street. Whoever collects needs the code; we note their name.
              </p>
            </section>
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
                      className={`grid size-6 shrink-0 place-items-center rounded-pill text-xs font-bold ${done ? 'bg-ink text-bg' : current ? 'bg-accent text-on-accent' : 'border border-border-strong text-muted'}`}
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
              {order.sample && order.status === 'in_production' && order.sample.status !== 'approved' && (
                <p className="mt-4 text-sm text-body">
                  Runs of {SAMPLE_THRESHOLD} pieces or more start with one sample for you to approve; the full run follows.
                  {order.sample.status === 'changes_requested' && ' We’re printing a new sample with your changes.'}
                </p>
              )}
              {eta && (
                <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-body">
                  <span>
                    {eta.left > 0 ? `${eta.left.toLocaleString('en-KE')} left` : 'All printed'}
                    {eta.finishBy && eta.left > 0 && (
                      <>
                        , finishing <strong className="text-heading">{eta.finishBy === today ? 'today' : formatDay(eta.finishBy)}</strong>
                      </>
                    )}
                    {order.production.promisedBy && <> · promised by {formatDay(order.production.promisedBy)}</>}
                  </span>
                  <span className={`inline-flex min-h-7 items-center px-2.5 text-xs font-semibold ${eta.atRisk ? 'bg-accent text-on-accent' : 'bg-ink text-bg'}`}>
                    {eta.atRisk ? 'At risk: we’ll call you' : 'On track'}
                  </span>
                </p>
              )}
              {order.production.logs.length > 0 && (
                <details className="mt-4">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-heading">From the production floor ({order.production.logs.length})</summary>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                    {[...order.production.logs].reverse().map((l, i) => (
                      <li key={`${l.at}-${i}`} className="flex justify-between gap-4 border-b border-border py-1.5">
                        <span className="text-heading">{l.note}</span>
                        <span className="text-muted">{when(l.at)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {!order.production.startedOn && order.estimate.readyBy && !closed && (
                <p className="mt-4 text-sm text-body">
                  Ready by about <strong className="text-heading">{formatDay(order.estimate.readyBy)}</strong> if the proof is approved on time; dates count from approval.
                </p>
              )}
            </div>
          </section>

          {showHandover && (
            <section aria-labelledby="handover-title" className="flex flex-col gap-4">
              <h2 id="handover-title" className="text-2xl font-bold">
                {order.handover.method === 'pickup' ? 'Pickup' : order.handover.method === 'install' ? 'Installation' : order.handover.method === 'digital' ? 'Your files' : 'Delivery'}
              </h2>
              {order.deliveries.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {order.deliveries.map((d) => (
                    <li key={d.id} className="flex gap-3 border border-border p-4">
                      <Truck aria-hidden className="mt-0.5 size-5 shrink-0 text-heading" />
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold text-heading">
                          {d.pieces.toLocaleString('en-KE')} pieces{d.partial ? ', sent early' : ''}:{' '}
                          {d.status === 'requested' ? 'asked for' : d.status === 'out' ? 'on the way' : 'delivered'}
                        </p>
                        {d.rider && (
                          <p className="mt-1 text-body">
                            Rider {d.rider},{' '}
                            <a href={`tel:${d.riderPhone}`} className="inline-flex min-h-11 items-center font-semibold text-link underline underline-offset-4">
                              {localPhone(d.riderPhone ?? '')}
                            </a>
                          </p>
                        )}
                        {d.waybill && <p className="mt-1 text-body">Courier waybill {d.waybill}</p>}
                        {d.recipient && d.deliveredAt && (
                          <p className="mt-1 text-muted">
                            Received by {d.recipient}, {when(d.deliveredAt)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {order.handedOver && (
                <p className="flex items-start gap-3 bg-paper p-4 text-sm text-heading">
                  <Package aria-hidden className="mt-0.5 size-5 shrink-0" />
                  <span>
                    {order.handedOver.detail} <span className="text-muted">{when(order.handedOver.at)}</span>
                  </span>
                </p>
              )}
              {canAskEarly && <PartialDeliveryForm orderRef={order.ref} token={token} max={earlyMax} />}
            </section>
          )}

          {pastProofs.length > 0 && (
            <section aria-labelledby="proofs-title">
              <h2 id="proofs-title" className="text-2xl font-bold">
                {reviewing ? 'Earlier versions' : 'Proofs'}
              </h2>
              <p className="mt-2 text-sm text-body">Every version is kept, with the notes on it, so you can compare.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pastProofs.map((proof) => (
                  <ProofVersion key={proof.version} proof={proof} productName={order.product.name} />
                ))}
              </div>
            </section>
          )}

          {order.survey && !order.siteQuote && order.status !== 'awaiting_payment' && !closed && (
            <section aria-labelledby="survey-title" className="flex flex-col gap-4 border border-ink p-5 sm:p-6">
              <h2 id="survey-title" className="text-xl font-bold">
                Site survey
              </h2>
              {order.survey.booked ? (
                <p className="text-body">
                  Booked for <strong className="text-heading">{formatDay(order.survey.booked)}</strong>. Our surveyor calls before coming to {order.handover.method === 'install' ? order.handover.address : 'the site'}; we measure,
                  check the surfaces, access and permits, then send your firm quote here.
                </p>
              ) : (
                <>
                  <p className="text-body">Choose a day for us to measure. Your preferred dates are first.</p>
                  <SurveyBooking orderRef={order.ref} token={token} min={addWorkingDays(today, 1)} preferred={order.survey.preferred} />
                </>
              )}
            </section>
          )}

          {order.siteQuote && (
            <section aria-labelledby="quote-title" className={`flex flex-col gap-4 ${order.siteQuote.status === 'pending' ? 'border border-ink p-5 sm:p-6' : ''}`}>
              <h2 id="quote-title" className={order.siteQuote.status === 'pending' ? 'text-xl font-bold' : 'text-2xl font-bold'}>
                {order.siteQuote.status === 'pending' ? 'Your firm quote' : 'Firm quote, accepted'}
              </h2>
              <p className="text-body">From the survey: {order.siteQuote.surveyNotes}</p>
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Quote lines">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink text-xs tracking-[0.12em] text-muted uppercase">
                      <th scope="col" className="py-2 pr-4 font-semibold">Item</th>
                      <th scope="col" className="py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.siteQuote.lines.map((l) => (
                      <tr key={l.label} className="border-b border-border">
                        <td className="py-3 pr-4">
                          <span className="block text-heading">{l.label}</span>
                          {l.detail && <span className="block text-muted">{l.detail}</span>}
                        </td>
                        <td className="py-3 text-right text-heading tabular-nums">{formatKes(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" className="pt-3 pr-4 text-left font-bold text-heading">Total</th>
                      <td className="pt-3 text-right text-lg font-bold text-heading tabular-nums">{formatKes(order.siteQuote.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-sm text-body">
                Half now ({formatKes(order.siteQuote.deposit)}) starts the design; the rest is due when you sign off the installation, less the{' '}
                {formatKes(order.estimate.dueNow.amount)} survey fee you’ve paid.
                {order.siteQuote.status === 'pending' && <> Valid until {formatDay(order.siteQuote.validUntil)}.</>}
              </p>
              {order.siteQuote.status === 'pending' && order.status === 'in_design' && (
                <AcceptQuote orderRef={order.ref} token={token} deposit={formatKes(order.siteQuote.deposit)} />
              )}
            </section>
          )}

          {order.mechanism === 'B' && order.status === 'in_production' && p.kind === 'stages' && !p.stages.find((x) => x.name === 'Installed')?.done && (
            <section aria-labelledby="install-title" className="flex flex-col gap-4 border border-ink p-5 sm:p-6">
              <h2 id="install-title" className="text-xl font-bold">
                Installation date
              </h2>
              <p className="text-body">
                {order.installDate ? (
                  <>
                    Booked for <strong className="text-heading">{formatDay(order.installDate)}</strong>. You can move it up to two working days before.
                  </>
                ) : (
                  'Choose a day for our team to install. We need two working days’ notice so the materials are ready.'
                )}
              </p>
              <InstallBooking orderRef={order.ref} token={token} min={earliestInstall(today)} current={order.installDate} />
            </section>
          )}

          <section aria-labelledby="payments-title">
            <h2 id="payments-title" className="text-2xl font-bold">
              Payments
            </h2>
            {order.payments.length ? (
              <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Payments table">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink text-xs tracking-[0.12em] text-muted uppercase">
                      <th scope="col" className="py-2 pr-4 font-semibold">For</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">How</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">M-Pesa ref.</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Amount</th>
                      <th scope="col" className="py-2 font-semibold">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.payments.map((pay) => (
                      <tr key={pay.id} className="border-b border-border">
                        <td className="py-3 pr-4 text-heading">{PURPOSE_LABEL[pay.purpose]}</td>
                        <td className="py-3 pr-4 text-body">{pay.method === 'stk' ? 'M-Pesa prompt' : 'Paybill'}</td>
                        <td className="py-3 pr-4 text-body">{PAYMENT_STATUS_LABEL[pay.status]}</td>
                        <td className="py-3 pr-4 font-mono text-body">{pay.mpesaReceipt ?? '—'}</td>
                        <td className="py-3 pr-4 text-right text-heading tabular-nums">{formatKes(pay.amount)}</td>
                        <td className="py-1">
                          {pay.receiptNo ? (
                            <Link href={withToken(`/order/${order.ref}/receipt/${pay.receiptNo}`, token)} className="inline-flex min-h-11 items-center font-semibold text-link underline underline-offset-4">
                              {pay.receiptNo}
                            </Link>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
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

          {demo && <DemoControls token={token} order={order} />}
        </div>

        <aside aria-label="Order summary" className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          {order.siteQuote?.status === 'accepted' ? (
            <div className="border border-border p-6">
              <p className="font-sans text-xs font-semibold tracking-[0.18em] text-muted uppercase">Price agreed</p>
              <p className="mt-3 flex items-baseline justify-between gap-4">
                <span className="font-semibold text-heading">Firm quote</span>
                <span className="text-2xl font-bold text-heading tabular-nums">{formatKes(order.siteQuote.total)}</span>
              </p>
              <p className="mt-2 text-sm text-body">Survey fee of {formatKes(order.estimate.dueNow.amount)} included, already paid.</p>
            </div>
          ) : (
            <div className="border border-border p-6">
              <PriceSummary estimate={order.estimate} heading="Price agreed" />
            </div>
          )}
          <Link
            href={withToken(`/order/${order.ref}/invoice`, token)}
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
