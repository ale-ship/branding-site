'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { reviewSampleAction } from '@/app/order/actions';
import { MAX_CHANGE_NOTES } from '@/lib/proof';
import { TextArea } from '../quote/fields';

/** The pre-production sample: one printed piece to approve before the full run (Mechanism A, big runs). */
export function SampleReview({ orderRef, token, photo, productName }: { orderRef: string; token: string; photo: string; productName: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const send = (decision: 'approve' | 'changes') => {
    if (decision === 'changes' && notes.trim().length < 5) return setError('Tell us what to change on the sample.');
    setError('');
    startTransition(async () => {
      const result = await reviewSampleAction(orderRef, token, decision, notes);
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  };

  return (
    <section aria-labelledby="sample-title" className="border border-ink">
      <div className="bg-ink px-5 py-4 sm:px-6">
        <h2 id="sample-title" className="text-xl font-bold text-bg">
          Check the sample
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-2">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={`Photo of one printed sample of your ${productName}`} className="block h-auto w-full border border-border" />
          <figcaption className="mt-2 text-sm text-muted">One piece, printed on the real material before the full run.</figcaption>
        </figure>
        <div className="flex flex-col gap-4">
          <p className="text-body">Approve it and we print the rest exactly like this. If something is off, tell us and we print a new sample.</p>
          {error && (
            <p role="alert" className="border-l-4 border-accent bg-paper px-4 py-3 text-heading">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => send('approve')}
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Check aria-hidden className="size-5" /> Approve the sample
          </button>
          <TextArea name="sample-notes" label="Or tell us what to change" value={notes} onChange={setNotes} maxLength={MAX_CHANGE_NOTES} />
          <button
            type="button"
            onClick={() => send('changes')}
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center border border-ink px-6 font-semibold text-ink transition-colors hover:bg-ink hover:text-bg disabled:opacity-60"
          >
            Ask for a new sample
          </button>
        </div>
      </div>
    </section>
  );
}
