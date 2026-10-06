'use client';

import { CalendarCheck, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { acceptSiteQuoteAction, bookInstallAction, bookSurveyAction } from '@/app/order/actions';
import { formatDay } from '@/lib/calendar';
import { TextField } from '../quote/fields';

/**
 * Site jobs (Mechanism B) on the order page: choose the survey date, accept the firm quote, choose the
 * installation date. Each one is checked again on the server.
 */

type Base = { orderRef: string; token: string };

function useAction() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    setError('');
    startTransition(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  };
  return { error, setError, pending, run };
}

const primary =
  'inline-flex min-h-12 items-center justify-center gap-2 bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60';
const secondary =
  'inline-flex min-h-12 items-center justify-center gap-2 border border-ink px-6 font-semibold text-ink transition-colors hover:bg-ink hover:text-bg disabled:opacity-60';

/** A date field and a button; `preferred` dates become one-tap choices. */
function DateBooking({ orderRef, token, name, label, min, preferred, current, submit, book }: Base & {
  name: string;
  label: string;
  min: string;
  preferred: string[];
  current: string | null;
  submit: string;
  book: (ref: string, token: string, date: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [date, setDate] = useState(current ?? preferred.find((d) => d >= min) ?? '');
  const { error, setError, pending, run } = useAction();
  const choices = preferred.filter((d) => d >= min);
  return (
    <div className="flex flex-col gap-4">
      {choices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {choices.map((d) => (
            <button
              key={d}
              type="button"
              disabled={pending}
              onClick={() => run(() => book(orderRef, token, d))}
              className={secondary}
            >
              <CalendarCheck aria-hidden className="size-4" />
              {formatDay(d)}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <TextField
            name={name}
            type="date"
            label={choices.length ? 'Or another date' : label}
            min={min}
            value={date}
            onChange={(v) => {
              setDate(v);
              setError('');
            }}
            error={error}
          />
        </div>
        <button type="button" disabled={pending} onClick={() => (date ? run(() => book(orderRef, token, date)) : setError('Choose a date.'))} className={primary}>
          {submit}
        </button>
      </div>
    </div>
  );
}

export function SurveyBooking(props: Base & { min: string; preferred: string[] }) {
  return <DateBooking {...props} name="survey-date" label="Survey date" current={null} submit="Book the survey" book={bookSurveyAction} />;
}

export function InstallBooking(props: Base & { min: string; current: string | null }) {
  return (
    <DateBooking
      {...props}
      name="install-date"
      label="Installation date"
      preferred={[]}
      submit={props.current ? 'Move the installation' : 'Book the installation'}
      book={bookInstallAction}
    />
  );
}

export function AcceptQuote({ orderRef, token, deposit }: Base & { deposit: string }) {
  const { error, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="border-l-4 border-accent bg-paper px-4 py-3 text-heading">
          {error}
        </p>
      )}
      <button type="button" disabled={pending} onClick={() => run(() => acceptSiteQuoteAction(orderRef, token))} className={`${primary} self-start`}>
        <Check aria-hidden className="size-5" />
        Accept the quote and pay {deposit}
      </button>
    </div>
  );
}
