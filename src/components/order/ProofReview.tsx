'use client';

import { Check, MapPin, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type MouseEvent } from 'react';
import { approveProofAction, requestChangesAction } from '@/app/order/actions';
import type { ApprovalChecklist, Proof, ProofPin } from '@/lib/api/order-types';
import { CHECKLIST, checklistComplete, emptyChecklist, MAX_CHANGE_NOTES, MAX_PIN_TEXT, MAX_PINS } from '@/lib/proof';
import { inputClass, TextArea } from '../quote/fields';
import { PinMarker } from './ProofFigure';

type Props = {
  orderRef: string;
  token: string;
  proof: Proof;
  productName: string;
  /** "1 of 2 revision rounds left", or null when rounds aren't counted. */
  roundsNote: string | null;
  /** Company orders: who approves. */
  approvalNote?: string;
};

/**
 * The customer's side of a proof (docs/ORDER_WORKFLOW_SPEC.md, "Proofs and approval"): tap the proof
 * to pin a note where something should change, or tick the checklist and approve. The server checks
 * the checklist and the notes again.
 */
export function ProofReview({ orderRef, token, proof, productName, roundsNote, approvalNote }: Props) {
  const router = useRouter();
  const [pins, setPins] = useState<ProofPin[]>([]);
  const [notes, setNotes] = useState('');
  const [ticks, setTicks] = useState<ApprovalChecklist>(emptyChecklist);
  const [message, setMessage] = useState<{ where: 'approve' | 'changes'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  // A new note gets the focus, so it can be typed straight away.
  const focusNext = useRef<number | null>(null);
  useEffect(() => {
    if (focusNext.current === null) return;
    document.getElementById(`pin-${focusNext.current}`)?.focus();
    focusNext.current = null;
  }, [pins.length]);

  const addPin = (x: number | null, y: number | null) => {
    if (pins.length >= MAX_PINS) {
      setMessage({ where: 'changes', text: `Up to ${MAX_PINS} notes per proof; write the rest in the box below.` });
      return;
    }
    setPins((p) => [...p, { x, y, text: '' }]);
    focusNext.current = pins.length;
  };

  const place = (e: MouseEvent<HTMLButtonElement>) => {
    // From the keyboard there is no pointer position: pin the middle, which the note can then describe.
    if (e.detail === 0) return addPin(0.5, 0.5);
    const box = e.currentTarget.getBoundingClientRect();
    addPin((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height);
  };

  const written = pins.filter((p) => p.text.trim());

  const approve = () => {
    if (written.length) return setMessage({ where: 'approve', text: 'You have notes on the proof: send them as changes, or remove them to approve.' });
    if (!checklistComplete(ticks)) return setMessage({ where: 'approve', text: 'Tick every item on the checklist to approve.' });
    setMessage(null);
    startTransition(async () => {
      const result = await approveProofAction(orderRef, token, proof.version, ticks);
      if (result.ok) router.refresh();
      else setMessage({ where: 'approve', text: result.message });
    });
  };

  const sendChanges = () => {
    if (!notes.trim() && !written.length) return setMessage({ where: 'changes', text: 'Tell the designer what to change: write a note, or tap the proof to pin one.' });
    setMessage(null);
    startTransition(async () => {
      const result = await requestChangesAction(orderRef, token, proof.version, notes, written);
      if (result.ok) router.refresh();
      else setMessage({ where: 'changes', text: result.message });
    });
  };

  const alert = (where: 'approve' | 'changes') =>
    message?.where === where && (
      <p role="alert" className="border-l-4 border-accent bg-paper px-4 py-3 text-heading">
        {message.text}
      </p>
    );

  return (
    <section aria-labelledby="proof-title" className="border border-ink">
      <div className="flex flex-wrap items-baseline justify-between gap-3 bg-ink px-5 py-4 text-bg sm:px-6">
        <h2 id="proof-title" className="text-xl font-bold text-bg">
          Check your proof, version {proof.version}
        </h2>
        {roundsNote && <span className="text-sm text-bg/80">{roundsNote}</span>}
      </div>

      <div className="flex flex-col gap-8 p-5 sm:p-6">
        <div>
          <p className="text-body">{proof.note} Nothing is printed until you approve this version.</p>
          <div className="relative mx-auto mt-5 w-full max-w-md select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proof.image} alt={`Proof v${proof.version} of your ${productName}, marked PROOF`} className="block h-auto w-full border border-border" draggable={false} />
            {pins.map((pin, i) => (
              <PinMarker key={i} pin={pin} n={i + 1} />
            ))}
            <button
              type="button"
              onClick={place}
              aria-label="Pin a note on the proof"
              className="absolute inset-0 cursor-crosshair focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
          </div>
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted">
            <MapPin aria-hidden className="size-4" /> Tap the proof where something should change to pin a note there.
          </p>
          {proof.mockup && (
            <figure className="mx-auto mt-6 w-full max-w-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proof.mockup} alt={`The design shown on your ${productName}`} className="block h-auto w-full border border-border" />
              <figcaption className="mt-2 text-center text-sm text-muted">On the item, for an idea of size. Colours on screen are a guide.</figcaption>
            </figure>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold">Approve</h3>
            <fieldset>
              <legend className="text-sm text-body">Before you approve, check:</legend>
              <div className="mt-2 flex flex-col">
                {CHECKLIST.map(({ key, label }) => (
                  <label key={key} htmlFor={`check-${key}`} className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-heading">
                    <input
                      id={`check-${key}`}
                      type="checkbox"
                      checked={ticks[key]}
                      onChange={(e) => setTicks((t) => ({ ...t, [key]: e.target.checked }))}
                      className="mt-0.5 size-5 shrink-0 accent-[var(--color-ink)]"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {alert('approve')}
            <button
              type="button"
              onClick={approve}
              disabled={pending}
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              <Check aria-hidden className="size-5" />
              Approve version {proof.version}
            </button>
            <p className="text-sm text-muted">Approving locks the artwork. Your deadline counts from here.</p>
            {approvalNote && <p className="text-sm text-heading">{approvalNote}</p>}
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold">Ask for changes</h3>
            {pins.length > 0 && (
              <ol className="flex flex-col gap-3">
                {pins.map((pin, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span aria-hidden className="mt-3 grid size-6 shrink-0 place-items-center rounded-pill bg-accent text-xs font-bold text-on-accent">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`pin-${i}`} className="sr-only">
                        Note {i + 1}
                        {pin.x === null ? ', about the whole proof' : ', pinned on the proof'}
                      </label>
                      <textarea
                        id={`pin-${i}`}
                        rows={2}
                        maxLength={MAX_PIN_TEXT}
                        value={pin.text}
                        placeholder={pin.x === null ? 'What should change?' : 'What should change here?'}
                        onChange={(e) => setPins((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                        className={`resize-y ${inputClass}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setPins((p) => p.filter((_, j) => j !== i))}
                      aria-label={`Remove note ${i + 1}`}
                      className="grid size-11 shrink-0 place-items-center text-muted transition-colors hover:text-heading"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <button
              type="button"
              onClick={() => addPin(null, null)}
              className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link underline underline-offset-4"
            >
              <Plus aria-hidden className="size-4" /> Add a note about the whole proof
            </button>
            <TextArea name="change-notes" label="Anything else" value={notes} onChange={setNotes} maxLength={MAX_CHANGE_NOTES} placeholder="For example: use the blue from our logo." />
            {alert('changes')}
            <button
              type="button"
              onClick={sendChanges}
              disabled={pending}
              className="inline-flex min-h-12 items-center justify-center border border-ink px-6 font-semibold text-ink transition-colors hover:bg-ink hover:text-bg disabled:opacity-60"
            >
              Send changes{written.length ? ` (${written.length} note${written.length === 1 ? '' : 's'})` : ''}
            </button>
            <p className="text-sm text-muted">Sending changes uses one revision round. A question for the designer doesn’t: ask it on WhatsApp.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
