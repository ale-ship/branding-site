'use client';

import { Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { requestCodeAction, verifyCodeAction } from '@/app/account/actions';
import { normaliseEmail } from '@/lib/account';
import { TextField } from '../quote/fields';

/** Email, then the six-digit code we email. No passwords. */
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<{ sentTo: string; demoCode?: string } | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const codeBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sent) codeBox.current?.querySelector('input')?.focus();
  }, [sent]);

  const send = () => {
    if (!normaliseEmail(email)) return setError('Enter your email address, like you@company.co.ke.');
    setError('');
    startTransition(async () => {
      const result = await requestCodeAction(email);
      if (result.ok) setSent({ sentTo: result.sentTo, demoCode: result.demoCode });
      else setError(result.message);
    });
  };

  const verify = () => {
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the six-digit code from the email.');
    setError('');
    startTransition(async () => {
      const result = await verifyCodeAction(email, code);
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
          <TextField name="signin-email" type="email" inputMode="email" autoComplete="email" label="Email" hint="The one you put on your orders." value={email} onChange={setEmail} error={error} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Mail aria-hidden className="size-5" />
            {pending ? 'Sending…' : 'Email me a code'}
          </button>
        </>
      ) : (
        <>
          <p role="status" className="text-body">
            We emailed a six-digit code to <strong className="text-heading">{sent.sentTo}</strong>. It works for ten minutes; if it isn’t there in a minute, look in spam.
          </p>
          {sent.demoCode && <p className="border border-dashed border-border-strong px-4 py-3 text-sm text-body">Demo: no email is sent. The code is {sent.demoCode}.</p>}
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
            Use another email, or send a new code
          </button>
        </>
      )}
    </form>
  );
}
