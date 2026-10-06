'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { demoAction, type DemoAction } from '@/app/order/actions';
import type { Order } from '@/lib/api/order-types';

const ACTIONS: { action: DemoAction; label: string; when: (s: Order['status'], o: Order) => boolean }[] = [
  { action: 'paybill-full', label: 'M-Pesa: Paybill payment of what’s due', when: (s) => s === 'awaiting_payment' || s === 'awaiting_balance' },
  { action: 'paybill-part', label: 'M-Pesa: Paybill part payment', when: (s) => s === 'awaiting_payment' || s === 'awaiting_balance' },
  { action: 'paybill-no-ref', label: 'M-Pesa: Paybill without the order number', when: (s) => s === 'awaiting_payment' || s === 'awaiting_balance' },
  { action: 'skip-wait', label: 'Skip the 60 s phone wait', when: (s) => s === 'awaiting_payment' || s === 'awaiting_balance' },
  { action: 'repeat-callback', label: 'M-Pesa: send the last callback again', when: () => true },
  { action: 'complete-survey', label: 'Staff: survey done, send the firm quote', when: (s, o) => s === 'in_design' && o.mechanism === 'B' && !!o.survey?.booked && !o.siteQuote },
  { action: 'upload-proof', label: 'Staff: upload a proof', when: (s, o) => s === 'in_design' && (o.mechanism !== 'B' || o.siteQuote?.status === 'accepted') },
  { action: 'approve-proof', label: 'Customer: approve the proof', when: (s) => s === 'awaiting_approval' },
  { action: 'request-changes', label: 'Customer: ask for changes', when: (s) => s === 'awaiting_approval' },
  { action: 'upload-sample', label: 'Staff: photograph a sample', when: (s, o) => s === 'in_production' && !!o.sample && (o.sample.status === 'waiting' || o.sample.status === 'changes_requested') },
  { action: 'log-progress', label: 'Staff: log production or the next stage', when: (s, o) => s === 'in_production' && (!o.sample || o.sample.status === 'approved') },
  { action: 'early-delivery', label: 'Staff: move the early delivery on', when: (_, o) => o.deliveries.some((d) => d.partial && d.status !== 'delivered') },
  { action: 'hand-over', label: 'Staff: hand over', when: (s) => s === 'ready' || s === 'out_for_handover' },
];

/**
 * Mock only. Plays M-Pesa and the staff so the whole flow can be tried before the backend and the
 * staff dashboard exist.
 */
export function DemoControls({ token, order }: { token: string; order: Order }) {
  const orderRef = order.ref;
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const available = ACTIONS.filter((a) => a.when(order.status, order));

  return (
    <section aria-labelledby="demo-title" className="border border-dashed border-border-strong p-5 sm:p-6">
      <h2 id="demo-title" className="font-sans text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Demo controls (mock only, not on the live site)
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {available.map((a) => (
          <button
            key={a.action}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await demoAction(orderRef, token, a.action);
                setMessage(result.message);
                router.refresh();
              })
            }
            className="inline-flex min-h-11 items-center border border-border-strong px-4 text-sm font-medium text-heading transition-colors hover:border-ink disabled:opacity-50"
          >
            {a.label}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-3 min-h-6 text-sm text-body">
        {message}
      </p>
    </section>
  );
}
