'use client';

import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { requestCodeAction, verifyCodeAction } from '@/app/account/actions';
import { normaliseKenyanPhone } from '@/lib/quote';
import { TextField } from '../quote/fields';

/** Phone, then the six-digit code sent on WhatsApp. No passwords. */
export function SignInForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<{ sentTo: string; demoCode?: string } | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const codeBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sent) codeBox.current?.querySelector('input')?.focus();
  }, [sent]);

  const send = () => {
    if (!normaliseKenyanPhone(phone)) return setError('Enter your phone number, like 0722 530 301.');
    setError('');
    startTransition(async () => {
      const result = await requestCodeAction(phone);
      if (result.ok) setSent({ sentTo: result.sentTo, demoCode: result.demoCode });
      else setError(result.message);
    });
  };

  const verify = () => {
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the six-digit code from WhatsApp.');
    setError('');
    startTransition(async () => {
      const result = await verifyCodeAction(phone, code);
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (sent) verify();
        else send();
      }}
      className="flex flex-col gap-5"
    >
      {!sent ? (
        <>
          <TextField name="signin-phone" type="tel" inputMode="tel" autoComplete="tel" label="Phone number" hint="The one you order and pay with." value={phone} onChange={setPhone} error={error} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <MessageCircle aria-hidden className="size-5" />
            {pending ? 'Sending…' : 'Send me a code on WhatsApp'}
          </button>
        </>
      ) : (
        <>
          <p role="status" className="text-body">
            We sent a six-digit code on WhatsApp to <strong className="text-heading">{sent.sentTo}</strong>. It works for ten minutes.
          </p>
          {sent.demoCode && <p className="border border-dashed border-border-strong px-4 py-3 text-sm text-body">Demo: no WhatsApp is sent. The code is {sent.demoCode}.</p>}
          <div ref={codeBox}>
            <TextField name="signin-code" inputMode="numeric" autoComplete="one-time-code" label="Code" value={code} onChange={setCode} error={error} />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? 'Checking…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSent(null);
              setCode('');
              setError('');
            }}
            className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-link underline underline-offset-4"
          >
            Use another number, or send a new code
          </button>
        </>
      )}
    </form>
  );
}
