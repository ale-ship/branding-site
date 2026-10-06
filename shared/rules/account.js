// @ts-check
import { DELIVERY_ZONES } from './pricing.js';

/**
 * @typedef {import('../contract/order-types.js').BrandKit} BrandKit
 * @typedef {import('../contract/order-types.js').DeliveryZone} DeliveryZone
 * @typedef {import('../contract/order-types.js').SavedAddress} SavedAddress
 */

/**
 * Account rules (docs/ORDER_WORKFLOW_SPEC.md, "Accounts"), shared by the account page, its server
 * actions and the backend. Sign-in is by phone and a one-time code on WhatsApp: no passwords to forget
 * or leak.
 */

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 10;
export const CODE_MAX_TRIES = 5;
/** Seconds before another code can be sent to the same phone. */
export const CODE_RESEND_SECONDS = 60;
export const SESSION_DAYS = 30;
export const MAX_ADDRESSES = 5;
export const MAX_KIT_COLOURS = 5;
export const MAX_KIT_LOGOS = 5;

export const SESSION_COOKIE = 'nb-session';

/** @param {string} code */
export const isCode = (code) => new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code.trim());

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const PANTONE = /^[a-z0-9][a-z0-9 \-]{1,29}$/i;

/**
 * @param {unknown} v
 * @param {number} max
 */
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** @returns {BrandKit} */
export function emptyBrandKit() {
  return { colours: [], typography: 'from-logo', fonts: '', logos: [], notes: '' };
}

/**
 * A brand kit from the browser, cleaned; `errors` says what to fix.
 * @param {unknown} raw
 * @returns {{ kit: BrandKit; errors: Record<string, string> }}
 */
export function coerceBrandKit(raw) {
  const r = /** @type {Record<string, unknown>} */ (raw && typeof raw === 'object' ? raw : {});
  /** @type {Record<string, string>} */
  const errors = {};
  const colours = (Array.isArray(r.colours) ? r.colours : []).map((c) => str(c, 40)).filter(Boolean);
  if (colours.length > MAX_KIT_COLOURS) errors.colours = `Up to ${MAX_KIT_COLOURS} colours.`;
  const bad = colours.find((c) => !HEX.test(c) && !PANTONE.test(c));
  if (bad) errors.colours = `“${bad}” isn’t a colour code: use HEX like #D7000F or a Pantone name like 485 C.`;
  /** @type {BrandKit['typography']} */
  const typography = r.typography === 'designer' || r.typography === 'named' ? r.typography : 'from-logo';
  const fonts = str(r.fonts, 200);
  if (typography === 'named' && !fonts) errors.fonts = 'Name your fonts, or choose another option.';
  const logos = (Array.isArray(r.logos) ? r.logos : [])
    .filter((f) => !!f && typeof f === 'object')
    .map((f) => /** @type {Record<string, unknown>} */ (f))
    .map((f) => ({ name: str(f.name, 120), size: typeof f.size === 'number' && f.size >= 0 ? Math.round(f.size) : 0, type: str(f.type, 80) }))
    .filter((f) => f.name)
    .slice(0, MAX_KIT_LOGOS);
  return { kit: { colours: colours.slice(0, MAX_KIT_COLOURS), typography, fonts, logos, notes: str(r.notes, 1000) }, errors };
}

/**
 * A saved address from the browser, cleaned; `error` says why it isn't usable.
 * @param {unknown} raw
 * @returns {{ address: Omit<SavedAddress, 'id'> & { id?: string }; error: string | null }}
 */
export function coerceAddress(raw) {
  const r = /** @type {Record<string, unknown>} */ (raw && typeof raw === 'object' ? raw : {});
  const zone = /** @type {DeliveryZone} */ (DELIVERY_ZONES.some((z) => z.zone === r.zone) ? r.zone : 'cbd');
  const address = { id: str(r.id, 40) || undefined, label: str(r.label, 40) || 'Address', address: str(r.address, 300), zone };
  return { address, error: address.address.length < 5 ? 'Enter the building, street, area and town.' : null };
}

/**
 * `+254722530301` -> `07•• ••• 301`, for saying where a code went without showing the whole number.
 * @param {string} msisdn
 * @returns {string}
 */
export function maskPhone(msisdn) {
  const m = /^\+254(\d)(\d{2})(\d{3})(\d{3})$/.exec(msisdn);
  return m ? `0${m[1]}•• ••• ${m[4]}` : msisdn;
}
