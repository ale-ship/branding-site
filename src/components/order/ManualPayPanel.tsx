'use client';

import { Check, MessageCircle, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { reportPaymentAction } from '@/app/order/actions';
import type { PaymentReport } from '@/lib/api/order-types';
import { formatKes } from '@/lib/format';
import { TextField } from '../quote/fields';

type Props = {
  orderRef: string;
  token: string;
  amount: number;
  /** "Deposit", "Balance", … */
  label: string;
  paybill: { number: string; account: string };
  /** WhatsApp with the whole order filled in. */
  whatsappHref: string;
  phone: { label: string; href: string };
  /** The code the customer already sent, while staff check it. */
  report: PaymentReport | null;
};

const at = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' }).format(new Date(iso));

/**
 * Paying by hand (owner, 21 Oct 2026), until the M-Pesa prompt is connected: the Paybill details, the
 * order on WhatsApp, and a form for the M-Pesa code. The order moves on only when a designer records
 * the payment in the back office, never on the customer saying they've paid.
 */
export function ManualPayPanel({ orderRef, token, amount, label, paybill, whatsappHref, phone, report }: Props) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [paid, setPaid] = useState('');
  const [error, setError] = useState('');
  const [again, setAgain] = useState(false);
  const [sending, startSending] = useTransition();
  const statusRef = useRef<HTMLParagraphElement>(null);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    startSending(async () => {
      const res = await reportPaymentAction(orderRef, token, code, paid);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setCode('');
      setPaid('');
      setAgain(false);
      router.refresh();
      requestAnimationFrame(() => statusRef.current?.focus());
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
        <div>
          <p className="font-semibold text-heading">Pay by M-Pesa Paybill</p>
          <ol className="mt-3 flex flex-col gap-2 text-body">
            <li>1. On your phone, open M-Pesa, then Lipa na M-Pesa, then Pay Bill.</li>
            <li>
              2. Business number: <strong className="text-heading tabular-nums">{paybill.number}</strong>
            </li>
            <li>
              {/* Never broken across lines: it is typed exactly. */}
              3. Account number: <strong className="block pl-4 whitespace-nowrap text-heading tabular-nums sm:inline sm:pl-0">{paybill.account}</strong>
            </li>
            <li>
              4. Amount: <strong className="text-heading tabular-nums">{formatKes(amount)}</strong>
            </li>
          </ol>
          <p className="mt-3 text-sm text-muted">Type the account number exactly as shown: the part after # tells us the payment is for {orderRef}.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-whatsapp px-6 font-semibold text-bg transition-colors hover:bg-whatsapp-hover"
          >
            <MessageCircle aria-hidden className="size-5" />
            Send my order on WhatsApp
          </a>
          <a
            href={phone.href}
            className="inline-flex min-h-12 items-center justify-center gap-2 border border-ink px-6 font-semibold text-ink transition-colors hover:bg-ink hover:text-bg"
          >
            <Phone aria-hidden className="size-5" />
            Call {phone.label}
          </a>
        </div>

        <div className="border-t border-border pt-5">
          {report && !again ? (
            <div role="status">
              <p ref={statusRef} tabIndex={-1} className="flex items-start gap-2 font-semibold text-heading outline-none">
                <Check aria-hidden className="mt-0.5 size-5 shrink-0" />
                <span>
                  We’re checking your payment {report.code}
                  {report.amount ? ` of ${formatKes(report.amount)}` : ''}.
                </span>
              </p>
              <p className="mt-1 text-body">
                Sent {at(report.at)}. We’ll confirm by email as soon as it’s in, and your order moves on with your receipt below.
              </p>
              <button type="button" onClick={() => setAgain(true)} className="mt-2 inline-flex min-h-11 items-center font-semibold text-link underline underline-offset-4">
                Sent the wrong code? Send another
              </button>
            </div>
          ) : (
            <form onSubmit={send} noValidate className="flex flex-col gap-4">
              <div>
                <p className="font-semibold text-heading">Paid? Send us your M-Pesa code</p>
                <p className="mt-1 text-sm text-muted">It’s in the M-Pesa message you got, like TJK4XY12AB. We check it and start your order.</p>
              </div>
              {error && (
                <p ref={statusRef} tabIndex={-1} role="alert" className="border-l-4 border-accent bg-paper px-4 py-3 text-heading outline-none">
                  {error}
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  name="pay-code"
                  label="M-Pesa code"
                  autoComplete="off"
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    setError('');
                  }}
                />
                <TextField name="pay-amount" label="Amount paid (KES)" inputMode="numeric" optional value={paid} onChange={setPaid} />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex min-h-12 items-center justify-center self-start bg-ink px-7 font-semibold text-bg transition-colors hover:bg-ink-hover disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Send code'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
