'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { requestPartialDeliveryAction } from '@/app/order/actions';
import { TextField } from '../quote/fields';

/** Asks for finished pieces early, as their own delivery (spec, "Fulfilment": partial delivery). */
export function PartialDeliveryForm({ orderRef, token, max }: { orderRef: string; token: string; max: number }) {
  const router = useRouter();
  const [pieces, setPieces] = useState(String(max));
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const send = () => {
    const n = Number(pieces.trim());
    if (!Number.isInteger(n) || n < 1) return setError('Enter how many finished pieces you want early.');
    if (n > max) return setError(`Only ${max.toLocaleString('en-KE')} finished pieces are waiting.`);
    setError('');
    startTransition(async () => {
      const result = await requestPartialDeliveryAction(orderRef, token, n);
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-3 bg-paper p-5">
      <h3 className="font-bold">Need some early?</h3>
      <p className="text-sm text-body">
        {max.toLocaleString('en-KE')} finished pieces are waiting. We can send them ahead of the rest; we confirm any extra delivery fee on WhatsApp first.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-48">
          <TextField name="early-pieces" label="Pieces to send now" inputMode="numeric" value={pieces} onChange={setPieces} error={error} />
        </div>
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center border border-ink px-6 font-semibold text-ink transition-colors hover:bg-ink hover:text-bg disabled:opacity-60"
        >
          Send these early
        </button>
      </div>
    </div>
  );
}
