'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { lookupOrderAction } from '@/app/order/actions';
import { TextField } from '../quote/fields';

/** "Find your order": the order number and the phone used to order. */
export function OrderLookup({ initialRef = '' }: { initialRef?: string }) {
  const router = useRouter();
  const [ref, setRef] = useState(initialRef);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const result = await lookupOrderAction(ref, phone);
      if (result.ok) {
        router.push(`/order/${result.ref}`);
        router.refresh();
      } else setError(result.message);
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-label="Find your order">
      <TextField name="lookup-ref" label="Order number" placeholder="NB-123456" value={ref} onChange={setRef} autoComplete="off" />
      <TextField name="lookup-phone" type="tel" inputMode="tel" label="Phone you ordered with" placeholder="0722 530 301" autoComplete="tel" value={phone} onChange={setPhone} />
      {error && (
        <p role="alert" className="border-l-4 border-accent bg-bg px-4 py-3 text-heading">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center self-start bg-ink px-7 font-semibold text-bg transition-colors hover:bg-ink-hover disabled:opacity-60">
        {pending ? 'Looking…' : 'Find my order'}
      </button>
    </form>
  );
}
