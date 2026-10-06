// @ts-check

/** @typedef {import('../contract/order-types.js').OrderProduct} OrderProduct */

/**
 * The artwork file check (docs/ORDER_WORKFLOW_SPEC.md, "Things worth adding"): when a customer sends
 * print-ready files, look inside them for the three usual problems (resolution under 150 dpi, RGB
 * instead of CMYK, no bleed) and warn before they pay. Pure, on the file's bytes: the order form runs
 * it in the browser; the backend runs it again on the real upload. A warning never blocks the order.
 */

export const MIN_DPI = 150;
export const GOOD_DPI = 300;
export const BLEED_MM = 3;
/** Only this much of a file is read (headers sit near the start; a PDF's boxes near the start or end). */
export const READ_BYTES = 4_000_000;

/**
 * Finished size in millimetres per product. TODO(business): confirm print areas.
 * @type {Record<string, { wMm: number; hMm: number; bleed: boolean }>}
 */
export const PRINT_SIZES = {
  'business-cards': { wMm: 85, hMm: 55, bleed: true },
  'a5-posters': { wMm: 148, hMm: 210, bleed: true },
  brochures: { wMm: 210, hMm: 297, bleed: true },
  'booklet-printing': { wMm: 210, hMm: 297, bleed: true },
  'a4-notebooks': { wMm: 210, hMm: 297, bleed: true },
  'banner-stands': { wMm: 850, hMm: 2000, bleed: true },
  't-shirt-printing': { wMm: 280, hMm: 350, bleed: false },
  'hoodie-branding': { wMm: 280, hMm: 350, bleed: false },
  'mug-branding': { wMm: 200, hMm: 85, bleed: false },
  'water-bottle-branding': { wMm: 60, hMm: 150, bleed: false },
  'umbrella-branding': { wMm: 300, hMm: 200, bleed: false },
  'branded-gift-bags': { wMm: 250, hMm: 300, bleed: false },
};

/**
 * @typedef {{ file: string; kind: 'resolution' | 'rgb' | 'bleed'; text: string }} ArtworkWarning
 * @typedef {{ width: number; height: number; colour: 'rgb' | 'cmyk' | 'grey' | 'unknown' }} ImageInfo
 */

/** @param {Uint8Array} b @param {number} i */
const u16 = (b, i) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
/** @param {Uint8Array} b @param {number} i */
const u32 = (b, i) => (((b[i] ?? 0) << 24) >>> 0) + ((b[i + 1] ?? 0) << 16) + ((b[i + 2] ?? 0) << 8) + (b[i + 3] ?? 0);

/**
 * PNG: size from IHDR. PNG has no CMYK, so colour is RGB unless it's greyscale.
 * @param {Uint8Array} b
 * @returns {ImageInfo | null}
 */
export function pngInfo(b) {
  if (b.length < 26 || b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  const type = b[25];
  return { width: u32(b, 16), height: u32(b, 20), colour: type === 0 || type === 4 ? 'grey' : 'rgb' };
}

/**
 * JPEG: size and channel count from the first SOF marker (4 channels is CMYK).
 * @param {Uint8Array} b
 * @returns {ImageInfo | null}
 */
export function jpegInfo(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1] ?? 0;
    const length = u16(b, i + 2);
    // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const channels = b[i + 9];
      return { height: u16(b, i + 5), width: u16(b, i + 7), colour: channels === 4 ? 'cmyk' : channels === 1 ? 'grey' : 'rgb' };
    }
    i += 2 + length;
  }
  return null;
}

/**
 * PDF, best effort on the readable text: which colour spaces it names and whether it has a bleed box.
 * @param {Uint8Array} b
 * @returns {{ rgb: boolean; cmyk: boolean; bleed: boolean } | null}
 */
export function pdfInfo(b) {
  const head = String.fromCharCode(...b.subarray(0, 5));
  if (head !== '%PDF-') return null;
  let text = '';
  for (let i = 0; i < b.length; i += 65536) text += String.fromCharCode(...b.subarray(i, i + 65536));
  /** @param {string} name */
  const box = (name) => {
    const m = new RegExp(`/${name}\\s*\\[\\s*([-\\d.\\s]+)\\]`).exec(text);
    return m?.[1]?.trim().split(/\s+/).map(Number) ?? null;
  };
  const bleed = box('BleedBox');
  const trim = box('TrimBox');
  const differs = !!bleed && !!trim && bleed.some((v, i) => Math.abs(v - (trim[i] ?? v)) > 0.5);
  return { rgb: /\/DeviceRGB|\/CalRGB|sRGB/.test(text), cmyk: /\/DeviceCMYK/.test(text), bleed: differs };
}

/**
 * Dots per inch when an image of this size fills the print area (either way round, whichever fits best).
 * @param {number} width
 * @param {number} height
 * @param {number} wMm
 * @param {number} hMm
 * @returns {number}
 */
export function dpiAt(width, height, wMm, hMm) {
  /** @param {number} mm */
  const inch = (mm) => mm / 25.4;
  const upright = Math.min(width / inch(wMm), height / inch(hMm));
  const turned = Math.min(width / inch(hMm), height / inch(wMm));
  return Math.round(Math.max(upright, turned));
}

/**
 * Whether an image's proportions match the finished size exactly, with no room for bleed.
 * @param {number} width
 * @param {number} height
 * @param {number} wMm
 * @param {number} hMm
 */
function noBleedRoom(width, height, wMm, hMm) {
  const ratio = width / height;
  const trim = [wMm / hMm, hMm / wMm];
  const withBleed = [(wMm + 2 * BLEED_MM) / (hMm + 2 * BLEED_MM), (hMm + 2 * BLEED_MM) / (wMm + 2 * BLEED_MM)];
  /** @param {number} a @param {number} b */
  const near = (a, b) => Math.abs(a - b) / b < 0.004;
  return trim.some((t) => near(ratio, t)) && !withBleed.some((t) => near(ratio, t));
}

/**
 * The warnings for one file, for one product. Unknown formats (AI, EPS, SVG…) get none: vector art scales.
 * @param {{ name: string; bytes: Uint8Array }} file
 * @param {Pick<OrderProduct, 'slug'>} product
 * @returns {ArtworkWarning[]}
 */
export function checkArtwork(file, product) {
  const size = PRINT_SIZES[product.slug];
  /** @type {ArtworkWarning[]} */
  const out = [];
  const name = file.name;
  const image = pngInfo(file.bytes) ?? jpegInfo(file.bytes);
  if (image) {
    if (size) {
      const dpi = dpiAt(image.width, image.height, size.wMm, size.hMm);
      if (dpi < MIN_DPI) {
        out.push({ file: name, kind: 'resolution', text: `About ${dpi} dpi at ${size.wMm} × ${size.hMm} mm, so it would print blurred. ${GOOD_DPI} dpi is best: send a larger file or the original artwork.` });
      }
      if (size.bleed && noBleedRoom(image.width, image.height, size.wMm, size.hMm)) {
        out.push({ file: name, kind: 'bleed', text: `No bleed: extend the background ${BLEED_MM} mm past each edge, or a thin white line may show after cutting.` });
      }
    }
    if (image.colour === 'rgb') out.push({ file: name, kind: 'rgb', text: 'RGB colours: bright screen colours print duller. We convert to CMYK; for exact colours send CMYK.' });
    return out;
  }
  const pdf = pdfInfo(file.bytes);
  if (pdf) {
    if (pdf.rgb && !pdf.cmyk) out.push({ file: name, kind: 'rgb', text: 'RGB colours: bright screen colours print duller. We convert to CMYK; for exact colours export as CMYK.' });
    if (size?.bleed && !pdf.bleed) out.push({ file: name, kind: 'bleed', text: `No bleed box found: export with ${BLEED_MM} mm bleed and crop marks.` });
  }
  return out;
}
