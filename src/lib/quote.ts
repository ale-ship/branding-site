import type {
  ArtworkFile,
  ContactChannel,
  FulfilmentMethod,
  QuoteRequest,
  ServiceSlug,
} from './api/types';

/**
 * Quote form rules, shared by the form (instant feedback) and the server action (the real
 * check). Pure functions; tests in quote.test.ts.
 */

/** What the form holds while the customer types: every field is a string or a list. */
export type QuoteDraft = {
  service: string;
  products: string[];
  quantity: string;
  details: string;
  artwork: ArtworkFile[];
  needsDesign: boolean;
  deadline: string;
  fulfilment: FulfilmentMethod;
  location: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  preferredContact: ContactChannel;
};

export type QuoteField = keyof QuoteDraft;
export type QuoteErrors = Partial<Record<QuoteField, string>>;

/** The form's steps and the fields each one owns, in order. */
export const QUOTE_STEPS = [
  { id: 'job', label: 'The job', fields: ['service', 'quantity', 'details'] },
  { id: 'artwork', label: 'Artwork and timing', fields: ['artwork', 'needsDesign', 'deadline', 'fulfilment', 'location'] },
  { id: 'contact', label: 'Your details', fields: ['name', 'company', 'phone', 'email', 'preferredContact'] },
] as const satisfies readonly { id: string; label: string; fields: readonly QuoteField[] }[];

export const ARTWORK_MAX_FILES = 5;
export const ARTWORK_MAX_BYTES = 25 * 1024 * 1024;
/** Print and design formats we accept. */
export const ARTWORK_EXTENSIONS = ['pdf', 'ai', 'eps', 'svg', 'psd', 'cdr', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'zip'];
export const DETAILS_MAX = 2000;

export function emptyDraft(service = ''): QuoteDraft {
  return {
    service,
    products: [],
    quantity: '',
    details: '',
    artwork: [],
    needsDesign: false,
    deadline: '',
    fulfilment: 'collect',
    location: '',
    name: '',
    company: '',
    phone: '',
    email: '',
    preferredContact: 'whatsapp',
  };
}

/**
 * Kenyan mobile or landline-style mobile numbers to +254XXXXXXXXX. Accepts 07…, 01…, 7…, 1…,
 * 2547…, +2547…, with spaces, dashes or brackets. Returns null for anything else.
 */
export function normaliseKenyanPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (!/^\d+$/.test(digits)) return null;
  let local: string;
  if (digits.startsWith('254')) local = digits.slice(3);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;
  return /^[17]\d{8}$/.test(local) ? `+254${local}` : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Today's date in Nairobi as YYYY-MM-DD. */
export function nairobiToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(now);
}

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Why a file can't be attached, or null if it's fine. */
export function artworkProblem(file: ArtworkFile): string | null {
  if (!ARTWORK_EXTENSIONS.includes(extension(file.name))) {
    return `${file.name}: use PDF, AI, EPS, SVG, PSD, CDR, PNG, JPG, TIFF or ZIP.`;
  }
  if (file.size > ARTWORK_MAX_BYTES) return `${file.name} is over 25 MB. Send big files on WhatsApp or email instead.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

/** Errors for the given fields only (one step), or every field when omitted. */
export function validateQuote(
  draft: QuoteDraft,
  knownServices: readonly string[],
  fields: readonly QuoteField[] = QUOTE_STEPS.flatMap((s) => s.fields),
  today = nairobiToday(),
): QuoteErrors {
  const errors: QuoteErrors = {};
  const check = (field: QuoteField, message: string | null) => {
    if (fields.includes(field) && message) errors[field] = message;
  };

  check('service', knownServices.includes(draft.service) ? null : 'Choose what you need.');

  const qty = draft.quantity.trim();
  check(
    'quantity',
    !qty ? 'Enter how many you need.' : /^\d+$/.test(qty) && Number(qty) >= 1 && Number(qty) <= 1_000_000 ? null : 'Enter a whole number, like 100.',
  );

  check(
    'details',
    draft.details.trim().length < 10
      ? 'Tell us a little about the job: sizes, colours, where it will be used.'
      : draft.details.length > DETAILS_MAX
        ? `Keep it under ${DETAILS_MAX} characters; you can send more on WhatsApp.`
        : null,
  );

  const fileProblem =
    draft.artwork.length > ARTWORK_MAX_FILES
      ? `Attach up to ${ARTWORK_MAX_FILES} files.`
      : (draft.artwork.map(artworkProblem).find((p) => p !== null) ?? null);
  check('artwork', fileProblem);

  check(
    'deadline',
    !draft.deadline ? null : !/^\d{4}-\d{2}-\d{2}$/.test(draft.deadline) ? 'Choose a date.' : draft.deadline < today ? 'Choose a date from today on.' : null,
  );

  check(
    'location',
    draft.fulfilment !== 'collect' && draft.location.trim().length < 3
      ? draft.fulfilment === 'install'
        ? 'Where should we install it?'
        : 'Where should we deliver it?'
      : null,
  );

  check('name', draft.name.trim().length < 2 ? 'Tell us your name.' : null);
  check('phone', normaliseKenyanPhone(draft.phone) ? null : 'Enter a Kenyan phone number, like 0722 530 301.');
  check(
    'email',
    !draft.email.trim()
      ? draft.preferredContact === 'email'
        ? 'Add your email so we can reply there.'
        : null
      : EMAIL.test(draft.email.trim())
        ? null
        : 'Check your email address.',
  );

  return errors;
}

const FULFILMENT: readonly FulfilmentMethod[] = ['collect', 'deliver', 'install'];
const CHANNELS: readonly ContactChannel[] = ['whatsapp', 'phone', 'email'];

/**
 * Rebuilds a draft from untrusted input (what the browser sent to the server action): every
 * field becomes the right type, lengths are capped, unknown enum values fall back to defaults
 * and unknown keys are dropped.
 */
export function coerceDraft(input: unknown): QuoteDraft {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const fulfilment = FULFILMENT.find((f) => f === o.fulfilment) ?? 'collect';
  const preferredContact = CHANNELS.find((c) => c === o.preferredContact) ?? 'whatsapp';
  return {
    service: str(o.service, 60),
    products: list(o.products).filter((p): p is string => typeof p === 'string').slice(0, 50).map((p) => p.slice(0, 80)),
    quantity: str(o.quantity, 12),
    // One more than the limit, so an over-long text still fails validation instead of being cut.
    details: str(o.details, DETAILS_MAX + 1),
    artwork: list(o.artwork)
      .slice(0, ARTWORK_MAX_FILES + 1)
      .map((f) => (f && typeof f === 'object' ? (f as Record<string, unknown>) : {}))
      .map((f) => ({
        name: str(f.name, 200),
        size: typeof f.size === 'number' && Number.isFinite(f.size) ? f.size : 0,
        type: str(f.type, 100),
      })),
    needsDesign: o.needsDesign === true,
    deadline: str(o.deadline, 10),
    fulfilment,
    location: str(o.location, 200),
    name: str(o.name, 120),
    company: str(o.company, 120),
    phone: str(o.phone, 30),
    email: str(o.email, 200),
    preferredContact,
  };
}

/** The validated request to send. Call only when validateQuote returns no errors. */
export function toQuoteRequest(draft: QuoteDraft): QuoteRequest {
  return {
    service: draft.service as ServiceSlug,
    products: draft.products,
    quantity: Number(draft.quantity.trim()),
    details: draft.details.trim(),
    artwork: draft.artwork.map(({ name, size, type }) => ({ name, size, type })),
    needsDesign: draft.needsDesign,
    deadline: draft.deadline,
    fulfilment: draft.fulfilment,
    location: draft.fulfilment === 'collect' ? '' : draft.location.trim(),
    name: draft.name.trim(),
    company: draft.company.trim(),
    phone: normaliseKenyanPhone(draft.phone) ?? '',
    email: draft.email.trim(),
    preferredContact: draft.preferredContact,
  };
}

/** `2400000` -> `2.3 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A WhatsApp message that carries the reference, so the chat links up with the request. */
export function whatsappFollowUp(reference: string, whatsappHref: string): string {
  const text = `Hello Noorcom, I've just sent quote request ${reference}. I'd like to send the artwork here.`;
  return `${whatsappHref}?text=${encodeURIComponent(text)}`;
}
