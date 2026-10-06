import type { BrandKit, DeliveryZone, SavedAddress } from './api/order-types';
import { DELIVERY_ZONES } from './pricing';

/**
 * Account rules (docs/ORDER_WORKFLOW_SPEC.md, "Accounts"), shared by the account page and its server
 * actions. Sign-in is by phone and a one-time code on WhatsApp: no passwords to forget or leak.
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

export const isCode = (code: string) => new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code.trim());

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const PANTONE = /^[a-z0-9][a-z0-9 \-]{1,29}$/i;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function emptyBrandKit(): BrandKit {
  return { colours: [], typography: 'from-logo', fonts: '', logos: [], notes: '' };
}

/** A brand kit from the browser, cleaned; `errors` says what to fix. */
export function coerceBrandKit(raw: unknown): { kit: BrandKit; errors: Record<string, string> } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const colours = (Array.isArray(r.colours) ? r.colours : []).map((c) => str(c, 40)).filter(Boolean);
  if (colours.length > MAX_KIT_COLOURS) errors.colours = `Up to ${MAX_KIT_COLOURS} colours.`;
  const bad = colours.find((c) => !HEX.test(c) && !PANTONE.test(c));
  if (bad) errors.colours = `“${bad}” isn’t a colour code: use HEX like #D7000F or a Pantone name like 485 C.`;
  const typography = r.typography === 'designer' || r.typography === 'named' ? r.typography : 'from-logo';
  const fonts = str(r.fonts, 200);
  if (typography === 'named' && !fonts) errors.fonts = 'Name your fonts, or choose another option.';
  const logos = (Array.isArray(r.logos) ? r.logos : [])
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({ name: str(f.name, 120), size: typeof f.size === 'number' && f.size >= 0 ? Math.round(f.size) : 0, type: str(f.type, 80) }))
    .filter((f) => f.name)
    .slice(0, MAX_KIT_LOGOS);
  return { kit: { colours: colours.slice(0, MAX_KIT_COLOURS), typography, fonts, logos, notes: str(r.notes, 1000) }, errors };
}

/** A saved address from the browser, cleaned; null with a reason when it isn't usable. */
export function coerceAddress(raw: unknown): { address: Omit<SavedAddress, 'id'> & { id?: string }; error: string | null } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const zone = (DELIVERY_ZONES.some((z) => z.zone === r.zone) ? r.zone : 'cbd') as DeliveryZone;
  const address = { id: str(r.id, 40) || undefined, label: str(r.label, 40) || 'Address', address: str(r.address, 300), zone };
  return { address, error: address.address.length < 5 ? 'Enter the building, street, area and town.' : null };
}

/** `+254722530301` -> `+254 7•• ••• 301`, for saying where a code went without showing the whole number. */
export function maskPhone(msisdn: string): string {
  const m = /^\+254(\d)(\d{2})(\d{3})(\d{3})$/.exec(msisdn);
  return m ? `0${m[1]}•• ••• ${m[4]}` : msisdn;
}
