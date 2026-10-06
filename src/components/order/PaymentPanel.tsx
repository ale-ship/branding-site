'use client';

import { Check, Loader2, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { paymentStatusAction, startPaymentAction } from '@/app/order/actions';
import type { OrderPayment } from '@/lib/api/order-types';
import { formatKes } from '@/lib/format';
import { normaliseKenyanPhone } from '@/lib/quote';
import { TextField } from '../quote/fields';

type Props = {
  orderRef: string;
  token: string;
  amount: number;
  /** "50% deposit", "Balance", … */
  label: string;
  defaultPhone: string;
  /** A prompt already on its way when the page loaded. */
  pending: OrderPayment | null;
  paybill: { number: string; account: string };
  /** Shows the mock's test numbers. */
  isMock: boolean;
};

const WAIT_SECONDS = 60;

/**
 * Pay by M-Pesa: STK Push by default, Paybill as the fallback. The order moves on only when the
 * payment's callback is confirmed on the server; this panel just asks and waits
 * (docs/ORDER_WORKFLOW_SPEC.md, "Payments").
 */
export function PaymentPanel({ orderRef, token, amount, label, defaultPhone, pending, paybill, isMock }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone);
  const [phoneError, setPhoneError] = useState('');
  const [payment, setPayment] = useState<OrderPayment | null>(pending);
  const [message, setMessage] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);
  const [sending, startSending] = useTransition();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const waiting = payment?.status === 'pending';

  // While the prompt is on the phone: count down, and ask the server every 3 seconds.
  useEffect(() => {
    if (!waiting || !payment) return;
    const started = Date.parse(payment.requestedAt);
    const tick = setInterval(() => setSecondsLeft(Math.max(0, WAIT_SECONDS - Math.floor((Date.now() - started) / 1000))), 1000);
    const poll = setInterval(async () => {
      const status = await paymentStatusAction(orderRef, token);
      const latest = status?.payments.find((p) => p.id === payment.id);
      if (!latest || latest.status === 'pending') return;
      setPayment(latest);
      if (latest.status === 'confirmed') router.refresh();
      else setMessage(latest.message ?? 'The payment didn’t go through.');
    }, 3000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [waiting, payment, orderRef, token, router]);

  useEffect(() => {
    if (payment && payment.status !== 'pending') statusRef.current?.focus();
  }, [payment]);

  const pay = () => {
    setMessage('');
    if (!normaliseKenyanPhone(phone)) {
      setPhoneError('Enter the Safaricom number to pay from, like 0722 530 301.');
      return;
    }
    setPhoneError('');
    startSending(async () => {
      const result = await startPaymentAction(orderRef, token, phone);
      if (result.ok) {
        setPayment(result.payment);
        setSecondsLeft(WAIT_SECONDS);
      } else setMessage(result.message);
    });
  };

  return (
    <section aria-labelledby="pay-title" className="border border-ink">
      <div className="flex flex-wrap items-baseline justify-between gap-3 bg-ink px-5 py-4 text-bg sm:px-6">
        <h2 id="pay-title" className="text-xl font-bold text-bg">
          Pay {formatKes(amount)}
        </h2>
        <span className="text-sm text-bg/80">{label}</span>
      </div>

      <div className="flex flex-col gap-6 p-5 sm:p-6">
        {waiting ? (
          <div className="flex items-start gap-4" role="status">
            <Loader2 aria-hidden className="mt-1 size-6 shrink-0 animate-spin text-heading" />
            <div>
              <p className="text-lg font-semibold text-heading">Check your phone</p>
              <p className="mt-1 text-body">
                Enter your M-Pesa PIN on the prompt sent to {phone}. This page updates by itself.
              </p>
              <p className="mt-2 text-sm text-muted tabular-nums">Waiting {secondsLeft} s…</p>
            </div>
          </div>
        ) : payment?.status === 'confirmed' ? (
          <p ref={statusRef} tabIndex={-1} className="flex items-center gap-2 font-semibold text-heading outline-none">
            <Check aria-hidden className="size-5" /> Paid. Receipt {payment.mpesaReceipt}.
          </p>
        ) : (
          <>
            {message && (
              <p ref={statusRef} tabIndex={-1} role="alert" className="border-l-4 border-accent bg-paper px-4 py-3 text-heading outline-none">
                {message} Try again, or pay by Paybill below.
              </p>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="sm:w-72">
                <TextField
                  name="pay-phone"
                  type="tel"
                  inputMode="tel"
                  label="M-Pesa number"
                  autoComplete="tel"
                  value={phone}
                  onChange={(v) => {
                    setPhone(v);
                    setPhoneError('');
                  }}
                  error={phoneError}
                />
              </div>
              <button
                type="button"
                onClick={pay}
                disabled={sending}
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-whatsapp px-7 font-semibold text-bg transition-colors hover:bg-whatsapp-hover disabled:opacity-60 sm:mb-0"
              >
                <Smartphone aria-hidden className="size-5" />
                {sending ? 'Sending…' : message ? 'Try again' : 'Pay with M-Pesa'}
              </button>
            </div>
            {isMock && (
              <p className="text-sm text-muted">
                Demo: no money moves. A number ending in 0 cancels, 1 doesn’t answer, 2 fails; any other number pays after a few seconds.
              </p>
            )}
          </>
        )}

        <details className="border-t border-border pt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold text-heading [&::-webkit-details-marker]:hidden">
            Or pay by Paybill
          </summary>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-body">
            <dt className="text-muted">Paybill</dt>
            <dd className="font-semibold text-heading tabular-nums">{paybill.number}</dd>
            <dt className="text-muted">Account number</dt>
            <dd className="font-semibold break-all text-heading tabular-nums">{paybill.account}</dd>
            <dt className="text-muted">Amount</dt>
            <dd className="font-semibold text-heading tabular-nums">{formatKes(amount)}</dd>
          </dl>
          <p className="mt-3 text-sm text-muted">
            Type the account number exactly as shown: the part after # tells us the payment is for {orderRef}. Your order moves on as soon as M-Pesa confirms
            it, and your receipt appears below.
          </p>
        </details>
      </div>
    </section>
  );
}
