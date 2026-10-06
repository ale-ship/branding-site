import type { ArtworkFile } from './api/types';
import type {
  BriefAnswers,
  BriefField,
  CommonBrief,
  DeliveryZone,
  Handover,
  OrderInput,
  OrderProduct,
  PriceRequest,
  UrgencyCode,
} from './api/order-types';
import { addWorkingDays } from './calendar';
import { artworkProblem, ARTWORK_MAX_FILES, DETAILS_MAX, nairobiToday, normaliseKenyanPhone } from './quote';

/**
 * The order form's rules (docs/ORDER_WORKFLOW_SPEC.md). Shared by the form, for instant feedback,
 * and the server action, which coerces and checks everything again. Tests in order.test.ts.
 */

/** A brief answer as the form holds it: numbers are still text while the customer types. */
export type DraftBriefValue = string | string[] | boolean | Record<string, string> | { widthCm: string; heightCm: string };

export type OrderDraft = {
  product: string;
  quantity: string;
  brief: Record<string, DraftBriefValue>;
  common: CommonBrief;
  urgency: UrgencyCode;
  handover: 'pickup' | 'delivery' | 'install' | 'digital';
  zone: DeliveryZone;
  address: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  /** The customer's PO or LPO number, for company orders. */
  poNumber: string;
  /** Agreed to the Terms. */
  agree: boolean;
};

/** Errors keyed by field: `quantity`, `brief.<id>`, `common.<key>`, `address`, `name`, … */
export type OrderErrors = Record<string, string | undefined>;

export const ORDER_STEPS = [
  { id: 'what', label: 'What you need' },
  { id: 'brief', label: 'Your brief' },
  { id: 'when', label: 'Deadline and delivery' },
  { id: 'you', label: 'Your details and payment' },
] as const;
export type OrderStepId = (typeof ORDER_STEPS)[number]['id'];

export const STYLE_TAGS = ['Minimal', 'Bold', 'Corporate', 'Playful', 'Luxury', 'Traditional'];
export const MAX_COLOURS = 5;
export const MAX_LINKS = 5;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;

export function emptyCommon(): CommonBrief {
  return {
    colours: [],
    typography: 'from-logo',
    fonts: '',
    assets: [],
    inspiration: [],
    inspirationLinks: [],
    text: '',
    styles: [],
    artwork: 'need-design',
    notes: '',
  };
}

/** The default answer for each brief field: the first option of a required select, else empty. */
export function emptyBrief(product: OrderProduct): Record<string, DraftBriefValue> {
  const brief: Record<string, DraftBriefValue> = {};
  for (const f of product.brief) {
    switch (f.kind) {
      case 'select':
        brief[f.id] = f.required ? (f.options[0]?.value ?? '') : '';
        break;
      case 'multiselect':
        brief[f.id] = f.required && f.options[0] ? [f.options[0].value] : [];
        break;
      case 'sizes':
        brief[f.id] = Object.fromEntries(f.sizes.map((s) => [s, '']));
        break;
      case 'dimensions':
        brief[f.id] = { widthCm: '', heightCm: '' };
        break;
      case 'dates':
        brief[f.id] = Array.from({ length: f.count }, () => '');
        break;
      case 'yesno':
        brief[f.id] = false;
        break;
      default:
        brief[f.id] = '';
    }
  }
  return brief;
}

export function emptyOrderDraft(product: OrderProduct): OrderDraft {
  return {
    product: product.slug,
    quantity: product.mechanism === 'A' ? String(product.minQuantity) : '1',
    brief: emptyBrief(product),
    common: emptyCommon(),
    urgency: 'standard',
    handover: product.mechanism === 'B' ? 'install' : product.mechanism === 'C' ? 'digital' : 'pickup',
    zone: 'inner',
    address: '',
    name: '',
    company: '',
    phone: '',
    email: '',
    poNumber: '',
    agree: false,
  };
}

/** Saved answers (a past order's) back into the form's text values, for this product's fields only. */
export function draftBriefFrom(product: OrderProduct, answers: BriefAnswers): Record<string, DraftBriefValue> {
  const brief = emptyBrief(product);
  for (const f of product.brief) {
    const v = answers[f.id];
    if (v === undefined) continue;
    if (typeof v === 'number') brief[f.id] = String(v);
    else if (typeof v === 'string' || typeof v === 'boolean' || Array.isArray(v)) brief[f.id] = structuredClone(v);
    else if ('widthCm' in v && 'heightCm' in v && typeof v.widthCm === 'number') brief[f.id] = { widthCm: String(v.widthCm), heightCm: String(v.heightCm) };
    else brief[f.id] = Object.fromEntries(Object.entries(v as Record<string, number>).map(([k, n]) => [k, n ? String(n) : '']));
  }
  return brief;
}

const intOf = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

/** Checks one product's brief answers. Keys are field ids. */
export function validateBrief(fields: BriefField[], brief: Record<string, DraftBriefValue>, quantity: number, today = nairobiToday()): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = brief[f.id];
    const missing = () => (errors[f.id] = `${f.label}: please answer this.`);
    switch (f.kind) {
      case 'select':
        if (typeof v !== 'string' || !v) {
          if (f.required) missing();
        } else if (!f.options.some((o) => o.value === v)) errors[f.id] = `${f.label}: choose one of the options.`;
        break;
      case 'multiselect': {
        const list = Array.isArray(v) ? v : [];
        if (f.required && !list.length) errors[f.id] = `${f.label}: choose at least one.`;
        else if (list.some((x) => !f.options.some((o) => o.value === x))) errors[f.id] = `${f.label}: choose from the options.`;
        else if (f.max && list.length > f.max) errors[f.id] = `${f.label}: choose up to ${f.max}.`;
        break;
      }
      case 'number': {
        const text = typeof v === 'string' ? v.trim() : '';
        if (!text) {
          if (f.required) missing();
          break;
        }
        const n = intOf(text);
        if (Number.isNaN(n)) errors[f.id] = `${f.label}: enter a whole number.`;
        else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
          errors[f.id] = `${f.label}: between ${f.min ?? 0} and ${f.max ?? '∞'}.`;
        }
        break;
      }
      case 'text':
      case 'textarea': {
        const text = typeof v === 'string' ? v.trim() : '';
        if (!text && f.required) missing();
        else if (f.maxLength && text.length > f.maxLength) errors[f.id] = `${f.label}: keep it under ${f.maxLength} characters.`;
        break;
      }
      case 'sizes': {
        const map = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
        const counts = f.sizes.map((s) => (map[s]?.trim() ? intOf(map[s]!) : 0));
        if (counts.some((c) => Number.isNaN(c))) errors[f.id] = `${f.label}: whole numbers only.`;
        else {
          const sum = counts.reduce((a, b) => a + b, 0);
          if (f.required && sum !== quantity) errors[f.id] = `${f.label}: these add up to ${sum}, but you’re ordering ${quantity}.`;
        }
        break;
      }
      case 'dimensions': {
        const d = v && typeof v === 'object' && 'widthCm' in v ? (v as { widthCm: string; heightCm: string }) : { widthCm: '', heightCm: '' };
        const w = d.widthCm.trim();
        const h = d.heightCm.trim();
        if (!w && !h) {
          if (f.required) missing();
          break;
        }
        const wn = intOf(w);
        const hn = intOf(h);
        if (Number.isNaN(wn) || Number.isNaN(hn) || wn < 1 || hn < 1) errors[f.id] = `${f.label}: width and height in whole centimetres.`;
        else if (f.maxCm && (wn > f.maxCm || hn > f.maxCm)) errors[f.id] = `${f.label}: up to ${f.maxCm} cm each way.`;
        break;
      }
      case 'dates': {
        const list = (Array.isArray(v) ? v : []).filter((x) => x);
        const earliest = addWorkingDays(today, 1);
        if (f.required && list.length < f.count) errors[f.id] = `${f.label}: choose ${f.count} dates.`;
        else if (list.some((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x))) errors[f.id] = `${f.label}: choose dates from the calendar.`;
        else if (list.some((x) => x < earliest)) errors[f.id] = `${f.label}: from the next working day on.`;
        break;
      }
      case 'yesno':
        break;
    }
  }
  return errors;
}

function validateCommon(common: CommonBrief, mechanism: OrderProduct['mechanism']): OrderErrors {
  const errors: OrderErrors = {};
  if (common.colours.length > MAX_COLOURS) errors['common.colours'] = `Up to ${MAX_COLOURS} colours.`;
  else {
    const bad = common.colours.find((c) => !HEX.test(c.trim()) && !/^[a-z0-9][a-z0-9 \-]{1,29}$/i.test(c.trim()));
    if (bad !== undefined) errors['common.colours'] = `“${bad}” isn’t a colour code: use HEX like #FF0000 or a Pantone name like 485 C.`;
  }
  if (common.typography === 'named' && !common.fonts.trim()) errors['common.fonts'] = 'Name the fonts, or choose another option.';
  for (const key of ['assets', 'inspiration'] as const) {
    const files: ArtworkFile[] = common[key];
    const problem = files.length > ARTWORK_MAX_FILES ? `Attach up to ${ARTWORK_MAX_FILES} files.` : (files.map(artworkProblem).find((p) => p) ?? null);
    if (problem) errors[`common.${key}`] = problem;
  }
  // One link per line in the form: blank lines don't count.
  const links = common.inspirationLinks.map((l) => l.trim()).filter(Boolean);
  if (links.length > MAX_LINKS) errors['common.inspirationLinks'] = `Up to ${MAX_LINKS} links.`;
  else if (links.some((l) => !URL_RE.test(l))) errors['common.inspirationLinks'] = 'Links must start with https://';
  if (common.styles.some((s) => !STYLE_TAGS.includes(s))) errors['common.styles'] = 'Choose from the styles shown.';
  if (common.text.length > DETAILS_MAX) errors['common.text'] = `Keep it under ${DETAILS_MAX} characters.`;
  if (common.notes.length > DETAILS_MAX) errors['common.notes'] = `Keep it under ${DETAILS_MAX} characters.`;
  if (mechanism === 'A' && common.artwork === 'print-ready' && !common.assets.length) {
    errors['common.assets'] = 'Attach your print-ready artwork, or choose “I need it designed”.';
  }
  return errors;
}

/** Errors for one step, or all steps when `step` is omitted. */
export function validateOrderDraft(draft: OrderDraft, product: OrderProduct, step?: OrderStepId, today = nairobiToday()): OrderErrors {
  const errors: OrderErrors = {};
  const want = (s: OrderStepId) => !step || step === s;
  const quantity = product.mechanism === 'A' ? intOf(draft.quantity) : 1;

  if (want('what')) {
    if (product.mechanism === 'A') {
      if (Number.isNaN(quantity)) errors.quantity = 'Enter how many you need, as a whole number.';
      else if (quantity < product.minQuantity) errors.quantity = `The minimum is ${product.minQuantity.toLocaleString('en-KE')} pieces.`;
      else if (quantity > 100_000) errors.quantity = 'For more than 100,000 pieces, ask us for a quote.';
    }
    const brief = validateBrief(product.brief, draft.brief, Number.isNaN(quantity) ? 0 : quantity, today);
    for (const [id, message] of Object.entries(brief)) errors[`brief.${id}`] = message;
  }
  if (want('brief')) Object.assign(errors, validateCommon(draft.common, product.mechanism));
  if (want('when')) {
    if (draft.handover === 'delivery' && draft.address.trim().length < 5) errors.address = 'Where should we deliver it? Building, street and area.';
  }
  if (want('you')) {
    if (draft.name.trim().length < 2) errors.name = 'Tell us your name.';
    if (!normaliseKenyanPhone(draft.phone)) errors.phone = 'Enter a Kenyan phone number, like 0722 530 301.';
    if (!EMAIL.test(draft.email.trim())) errors.email = 'Enter your email: we send the receipt and proofs there.';
    if (!draft.agree) errors.agree = 'Please agree to the Terms to place your order.';
  }
  return errors;
}

/** Which step a field belongs to, so the form can go back to the first problem. */
export function stepOfField(key: string): OrderStepId {
  if (key === 'quantity' || key.startsWith('brief.')) return 'what';
  if (key.startsWith('common.')) return 'brief';
  if (key === 'address' || key === 'zone' || key === 'urgency') return 'when';
  return 'you';
}

/** The brief as numbers and lists, for pricing and the order. Unparseable numbers become 0. */
export function toBriefAnswers(fields: BriefField[], brief: Record<string, DraftBriefValue>): BriefAnswers {
  const answers: BriefAnswers = {};
  for (const f of fields) {
    const v = brief[f.id];
    switch (f.kind) {
      case 'number': {
        const n = intOf(typeof v === 'string' ? v : '');
        if (!Number.isNaN(n)) answers[f.id] = n;
        break;
      }
      case 'sizes': {
        const map = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
        answers[f.id] = Object.fromEntries(f.sizes.map((s) => [s, intOf(map[s] ?? '') || 0]));
        break;
      }
      case 'dimensions': {
        const d = v && typeof v === 'object' && 'widthCm' in v ? (v as { widthCm: string; heightCm: string }) : null;
        if (d && intOf(d.widthCm) > 0 && intOf(d.heightCm) > 0) answers[f.id] = { widthCm: intOf(d.widthCm), heightCm: intOf(d.heightCm) };
        break;
      }
      case 'dates':
        answers[f.id] = (Array.isArray(v) ? v : []).filter((x) => x);
        break;
      case 'yesno':
        answers[f.id] = v === true;
        break;
      case 'multiselect':
        answers[f.id] = Array.isArray(v) ? v : [];
        break;
      default:
        if (typeof v === 'string' && v.trim()) answers[f.id] = v.trim();
    }
  }
  return answers;
}

export function toHandover(draft: OrderDraft, product: OrderProduct): Handover {
  if (product.mechanism === 'B') {
    const site = draft.brief.siteAddress;
    return { method: 'install', address: typeof site === 'string' ? site.trim() : draft.address.trim() };
  }
  if (product.mechanism === 'C') return { method: 'digital' };
  return draft.handover === 'delivery' ? { method: 'delivery', zone: draft.zone, address: draft.address.trim() } : { method: 'pickup' };
}

/** A price request from the draft, tolerant of half-typed input (for the live price). */
export function toPriceRequest(draft: OrderDraft, product: OrderProduct): PriceRequest {
  const q = intOf(draft.quantity);
  const quantity = product.mechanism === 'A' ? (Number.isNaN(q) || q < product.minQuantity ? product.minQuantity : q) : 1;
  return {
    product: product.slug,
    quantity,
    brief: toBriefAnswers(product.brief, draft.brief),
    needsDesign: product.mechanism === 'C' || draft.common.artwork === 'need-design',
    urgency: draft.urgency,
    handover: toHandover(draft, product),
  };
}

/** The order to send. Call only when validateOrderDraft returns no errors. */
export function toOrderInput(draft: OrderDraft, product: OrderProduct): OrderInput {
  const trimFiles = (files: ArtworkFile[]) => files.map(({ name, size, type }) => ({ name, size, type }));
  return {
    ...toPriceRequest(draft, product),
    common: {
      ...draft.common,
      colours: draft.common.colours.map((c) => c.trim()).filter(Boolean),
      fonts: draft.common.fonts.trim(),
      assets: trimFiles(draft.common.assets),
      inspiration: trimFiles(draft.common.inspiration),
      inspirationLinks: draft.common.inspirationLinks.map((l) => l.trim()).filter(Boolean),
      text: draft.common.text.trim(),
      notes: draft.common.notes.trim(),
      artwork: product.mechanism === 'C' ? 'need-design' : draft.common.artwork,
    },
    customer: {
      name: draft.name.trim(),
      company: draft.company.trim(),
      phone: normaliseKenyanPhone(draft.phone) ?? '',
      email: draft.email.trim(),
    },
  };
}

// ── Untrusted input ─────────────────────────────────────────────────────────

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const strList = (v: unknown, maxItems: number, maxLen = 200) =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string').slice(0, maxItems).map((x) => x.slice(0, maxLen));
const files = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .slice(0, ARTWORK_MAX_FILES + 1)
    .map((f) => (f && typeof f === 'object' ? (f as Record<string, unknown>) : {}))
    .map((f) => ({ name: str(f.name), size: typeof f.size === 'number' && Number.isFinite(f.size) ? f.size : 0, type: str(f.type, 100) }));

/**
 * Rebuilds a draft from what the browser sent, against the product's own brief schema: unknown
 * keys are dropped, every value gets its expected type, lengths are capped.
 */
export function coerceOrderDraft(input: unknown, product: OrderProduct): OrderDraft {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const rawBrief = (o.brief && typeof o.brief === 'object' ? o.brief : {}) as Record<string, unknown>;
  const base = emptyOrderDraft(product);
  const brief: Record<string, DraftBriefValue> = {};
  for (const f of product.brief) {
    const v = rawBrief[f.id];
    switch (f.kind) {
      case 'multiselect':
        brief[f.id] = strList(v, f.options.length + 1, 60);
        break;
      case 'dates':
        brief[f.id] = strList(v, f.count, 10);
        break;
      case 'yesno':
        brief[f.id] = v === true;
        break;
      case 'sizes': {
        const m = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
        brief[f.id] = Object.fromEntries(f.sizes.map((s) => [s, str(m[s], 7)]));
        break;
      }
      case 'dimensions': {
        const m = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
        brief[f.id] = { widthCm: str(m.widthCm, 6), heightCm: str(m.heightCm, 6) };
        break;
      }
      default:
        brief[f.id] = str(v, f.kind === 'textarea' ? DETAILS_MAX + 1 : 201);
    }
  }
  const c = (o.common && typeof o.common === 'object' ? o.common : {}) as Record<string, unknown>;
  const typography = (['from-logo', 'designer', 'named'] as const).find((t) => t === c.typography) ?? 'from-logo';
  const artwork = (['print-ready', 'need-design'] as const).find((t) => t === c.artwork) ?? 'need-design';
  const urgency = (['economy', 'standard', 'express', 'rush'] as const).find((t) => t === o.urgency) ?? 'standard';
  const handover = (['pickup', 'delivery', 'install', 'digital'] as const).find((t) => t === o.handover) ?? base.handover;
  const zone = (['cbd', 'inner', 'outer', 'countrywide'] as const).find((t) => t === o.zone) ?? 'inner';
  return {
    product: product.slug,
    quantity: str(o.quantity, 8),
    brief,
    common: {
      colours: strList(c.colours, MAX_COLOURS + 1, 40),
      typography,
      fonts: str(c.fonts, 200),
      assets: files(c.assets),
      inspiration: files(c.inspiration),
      inspirationLinks: strList(c.inspirationLinks, 20, 300),
      text: str(c.text, DETAILS_MAX + 1),
      styles: strList(c.styles, STYLE_TAGS.length + 1, 30),
      artwork,
      notes: str(c.notes, DETAILS_MAX + 1),
    },
    urgency,
    // A product's mechanism fixes the handover for B and C, whatever was sent.
    handover: product.mechanism === 'A' ? (handover === 'delivery' ? 'delivery' : 'pickup') : base.handover,
    zone,
    address: str(o.address, 200),
    name: str(o.name, 120),
    company: str(o.company, 120),
    phone: str(o.phone, 30),
    email: str(o.email, 200),
    poNumber: str(o.poNumber, 40),
    agree: o.agree === true,
  };
}

/** The brief as label and value pairs, for the order page and the invoice. Empty answers are left out. */
export function describeBrief(fields: BriefField[], answers: BriefAnswers): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const f of fields) {
    const v = answers[f.id];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;
    let value = '';
    if (f.kind === 'select') value = f.options.find((o) => o.value === v)?.label ?? String(v);
    else if (f.kind === 'multiselect' && Array.isArray(v)) value = v.map((x) => f.options.find((o) => o.value === x)?.label ?? x).join(', ');
    else if (f.kind === 'sizes' && v && typeof v === 'object' && !Array.isArray(v)) {
      value = Object.entries(v as Record<string, number>)
        .filter(([, n]) => n > 0)
        .map(([size, n]) => `${size} ${n}`)
        .join(', ');
    } else if (f.kind === 'dimensions' && v && typeof v === 'object' && 'widthCm' in v) value = `${v.widthCm} × ${v.heightCm} cm`;
    else if (f.kind === 'yesno') value = v === true ? 'Yes' : 'No';
    else if (f.kind === 'number') value = `${v}${f.unit ? ` ${f.unit}` : ''}`;
    else if (Array.isArray(v)) value = v.join(', ');
    else value = String(v);
    if (value) rows.push({ label: f.label, value });
  }
  return rows;
}
