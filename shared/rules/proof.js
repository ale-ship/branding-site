// @ts-check

/**
 * @typedef {import('../contract/order-types.js').ApprovalChecklist} ApprovalChecklist
 * @typedef {import('../contract/order-types.js').ProofPin} ProofPin
 */

/**
 * Proof rules (docs/ORDER_WORKFLOW_SPEC.md, "Proofs and approval"), shared by the proof review on the
 * order page, the site's server actions and the backend, which all coerce and check again.
 */

/**
 * What the customer confirms before approving, in the order shown.
 * @type {{ key: keyof ApprovalChecklist; label: string }[]}
 */
export const CHECKLIST = [
  { key: 'spelling', label: 'Every word and number is spelt right' },
  { key: 'colours', label: 'The colours are the ones I want' },
  { key: 'size', label: 'The size and layout are right' },
  { key: 'quantity', label: 'The quantity and options are right' },
  { key: 'colourVariance', label: 'I understand printed colours may vary slightly from my screen' },
];

export const MAX_PINS = 20;
export const MAX_PIN_TEXT = 300;
export const MAX_CHANGE_NOTES = 2000;

/** @returns {ApprovalChecklist} */
export const emptyChecklist = () => ({ spelling: false, colours: false, size: false, quantity: false, colourVariance: false });

/**
 * Only an explicit `true` counts as ticked.
 * @param {unknown} raw
 * @returns {ApprovalChecklist}
 */
export function coerceChecklist(raw) {
  const r = /** @type {Record<string, unknown>} */ (raw && typeof raw === 'object' ? raw : {});
  const out = emptyChecklist();
  for (const { key } of CHECKLIST) out[key] = r[key] === true;
  return out;
}

/** @param {ApprovalChecklist} c */
export const checklistComplete = (c) => CHECKLIST.every(({ key }) => c[key]);

/**
 * @param {unknown} v
 * @returns {number | null}
 */
const fraction = (v) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000 : null;
};

/**
 * Pins from the browser: at most MAX_PINS, text trimmed and cut to MAX_PIN_TEXT, empty notes dropped,
 * positions clamped to the image (a pin with only one coordinate becomes a general note).
 * @param {unknown} raw
 * @returns {ProofPin[]}
 */
export function coercePins(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {ProofPin[]} */
  const pins = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = /** @type {Record<string, unknown>} */ (item);
    const text = typeof r.text === 'string' ? r.text.trim().slice(0, MAX_PIN_TEXT) : '';
    if (!text) continue;
    const x = fraction(r.x);
    const y = fraction(r.y);
    pins.push(x === null || y === null ? { x: null, y: null, text } : { x, y, text });
    if (pins.length === MAX_PINS) break;
  }
  return pins;
}

/**
 * Why a change request can't be sent, or null. Notes or at least one pin are needed.
 * @param {string} comments
 * @param {ProofPin[]} pins
 * @returns {string | null}
 */
export function changeRequestError(comments, pins) {
  if (comments.trim().length < 5 && pins.length === 0) return 'Tell the designer what to change: write a note, or tap the proof to pin one.';
  return null;
}
