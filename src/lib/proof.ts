import type { ApprovalChecklist, ProofPin } from './api/order-types';

/**
 * Proof rules (docs/ORDER_WORKFLOW_SPEC.md, "Proofs and approval"), shared by the proof review on the
 * order page and the server actions, which coerce and check everything again.
 */

/** What the customer confirms before approving, in the order shown. */
export const CHECKLIST: { key: keyof ApprovalChecklist; label: string }[] = [
  { key: 'spelling', label: 'Every word and number is spelt right' },
  { key: 'colours', label: 'The colours are the ones I want' },
  { key: 'size', label: 'The size and layout are right' },
  { key: 'quantity', label: 'The quantity and options are right' },
  { key: 'colourVariance', label: 'I understand printed colours may vary slightly from my screen' },
];

export const MAX_PINS = 20;
export const MAX_PIN_TEXT = 300;
export const MAX_CHANGE_NOTES = 2000;

export const emptyChecklist = (): ApprovalChecklist => ({ spelling: false, colours: false, size: false, quantity: false, colourVariance: false });

/** Only an explicit `true` counts as ticked. */
export function coerceChecklist(raw: unknown): ApprovalChecklist {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = emptyChecklist();
  for (const { key } of CHECKLIST) out[key] = r[key] === true;
  return out;
}

export const checklistComplete = (c: ApprovalChecklist) => CHECKLIST.every(({ key }) => c[key]);

const fraction = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000 : null;
};

/**
 * Pins from the browser: at most MAX_PINS, text trimmed and cut to MAX_PIN_TEXT, empty notes dropped,
 * positions clamped to the image (a pin with only one coordinate becomes a general note).
 */
export function coercePins(raw: unknown): ProofPin[] {
  if (!Array.isArray(raw)) return [];
  const pins: ProofPin[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const text = typeof r.text === 'string' ? r.text.trim().slice(0, MAX_PIN_TEXT) : '';
    if (!text) continue;
    const x = fraction(r.x);
    const y = fraction(r.y);
    pins.push(x === null || y === null ? { x: null, y: null, text } : { x, y, text });
    if (pins.length === MAX_PINS) break;
  }
  return pins;
}

/** Why a change request can't be sent, or null. Notes or at least one pin are needed. */
export function changeRequestError(comments: string, pins: ProofPin[]): string | null {
  if (comments.trim().length < 5 && pins.length === 0) return 'Tell the designer what to change: write a note, or tap the proof to pin one.';
  return null;
}
