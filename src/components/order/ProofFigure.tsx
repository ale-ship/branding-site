import type { ReactNode } from 'react';
import type { Proof, ProofPin } from '@/lib/api/order-types';

/**
 * A proof image with its pinned notes drawn as numbered markers. Plain markup, so the order page
 * (server) and the proof review (client) both use it. The markers are decoration: the numbered list
 * under the image carries the notes for screen readers.
 */

export const PROOF_STATUS: Record<Proof['status'], string> = {
  pending: 'Waiting for you',
  approved: 'Approved',
  changes_requested: 'Changes asked for',
};

export function PinMarker({ pin, n }: { pin: ProofPin; n: number }) {
  if (pin.x === null || pin.y === null) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-pill bg-accent text-xs font-bold text-on-accent shadow-[0_0_0_2px_var(--color-bg)]"
      style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
    >
      {n}
    </span>
  );
}

export function ProofImage({ src, alt, pins, children }: { src: string; alt: string; pins: ProofPin[]; children?: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-md select-none">
      {/* A data URI or a signed link to the designer's file: next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block h-auto w-full border border-border" draggable={false} />
      {pins.map((pin, i) => (
        <PinMarker key={i} pin={pin} n={i + 1} />
      ))}
      {children}
    </div>
  );
}

/** The notes behind the markers, numbered to match. */
export function PinList({ pins }: { pins: ProofPin[] }) {
  if (!pins.length) return null;
  return (
    <ol className="mt-3 flex flex-col gap-1.5 text-sm">
      {pins.map((pin, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-pill bg-accent text-[0.7rem] font-bold text-on-accent">
            {i + 1}
          </span>
          <span className="text-heading">
            <span className="sr-only">Note {i + 1}{pin.x === null ? ', about the whole proof' : ', pinned on the proof'}: </span>
            {pin.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A past version, for comparing: the image, its pins and what was said. */
export function ProofVersion({ proof, productName }: { proof: Proof; productName: string }) {
  return (
    <figure className="border border-border p-4">
      <ProofImage src={proof.image} alt={`Proof v${proof.version} of your ${productName}, marked PROOF`} pins={proof.pins} />
      <figcaption className="mt-3">
        <p className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold text-heading">Version {proof.version}</span>
          <span className="text-sm text-muted">{PROOF_STATUS[proof.status]}</span>
        </p>
        <p className="mt-1 text-sm text-body">{proof.note}</p>
        {proof.comments && <p className="mt-2 text-sm text-heading">“{proof.comments}”</p>}
        <PinList pins={proof.pins} />
      </figcaption>
    </figure>
  );
}
