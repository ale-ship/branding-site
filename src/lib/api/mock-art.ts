import type { Order } from './order-types';

/**
 * Mock only: draws stand-in proofs and sample photos as SVG data URIs, from the order's own brief
 * (colours, company, words), so the proof flow can be tried without uploads. The backend returns
 * signed links to the designer's real files instead. No people, as everywhere on the site.
 */

type Size = { w: number; h: number };

/** The flat artwork's proportions, by kind of product. */
const SIZES: Record<string, Size> = {
  stationery: { w: 340, h: 220 },
  print: { w: 240, h: 340 },
  books: { w: 240, h: 330 },
  'large-format': { w: 420, h: 160 },
  apparel: { w: 300, h: 300 },
  'corporate-gifts': { w: 300, h: 300 },
  design: { w: 280, h: 340 },
};
const WIDE: Size = { w: 400, h: 225 };

const HEX = /^#[0-9a-f]{6}$/i;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

const toUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

type Art = { size: Size; body: string };

/** The design itself: brand colour ground, a mark with the initial, the name and the words. */
function art(order: Order, version: number): Art {
  const size = SIZES[order.product.category] ?? WIDE;
  const { w, h } = size;
  const colours = order.common.colours.filter((c) => HEX.test(c));
  const ground = colours[0] ?? '#111111';
  const accent = colours[1] ?? '#d7000f';
  const ink = luminance(ground) > 0.35 ? '#111111' : '#ffffff';
  const name = (order.customer.company || order.customer.name).trim().slice(0, 28);
  const words = (order.common.text.split('\n')[0] || order.product.name).trim().slice(0, 40);
  // Each revision grows the mark a little, so versions can be told apart.
  const m = Math.round(Math.min(w, h) * (0.22 + 0.05 * Math.min(version - 1, 3)));
  const pad = Math.round(Math.min(w, h) * 0.1);
  const big = Math.max(14, Math.round(Math.min(w, h) * 0.11));
  const small = Math.max(10, Math.round(big * 0.5));
  const body = `<rect width="${w}" height="${h}" fill="${ground}"/>
<rect x="${pad}" y="${pad}" width="${m}" height="${m}" fill="${accent}"/>
<text x="${pad + m / 2}" y="${pad + m * 0.7}" font-family="Arial, sans-serif" font-weight="800" font-size="${Math.round(m * 0.6)}" fill="#ffffff" text-anchor="middle">${escape(name.charAt(0).toUpperCase() || 'N')}</text>
<text x="${pad}" y="${h - pad - small * 1.8}" font-family="Arial, sans-serif" font-weight="800" font-size="${big}" fill="${ink}">${escape(name)}</text>
<text x="${pad}" y="${h - pad}" font-family="Arial, sans-serif" font-size="${small}" fill="${ink}" fill-opacity="0.8">${escape(words)}</text>`;
  return { size, body };
}

/** Diagonal PROOF marks across the whole image, so it can't be used without paying. */
function watermark({ w, h }: Size, version: number): string {
  const marks: string[] = [];
  for (let y = 30; y < h + 60; y += 70) {
    for (let x = -40; x < w + 40; x += 130) {
      marks.push(`<text x="${x + ((y / 70) % 2) * 65}" y="${y}" transform="rotate(-24 ${x} ${y})">PROOF</text>`);
    }
  }
  return `<g font-family="Arial, sans-serif" font-weight="800" font-size="26" fill="#ffffff" fill-opacity="0.32" stroke="#000000" stroke-opacity="0.18" stroke-width="0.6">${marks.join('')}</g>
<rect x="${w - 46}" y="6" width="40" height="20" fill="#ffffff"/><text x="${w - 26}" y="21" font-family="Arial, sans-serif" font-weight="700" font-size="12" fill="#111111" text-anchor="middle">v${version}</text>`;
}

export function proofImage(order: Order, version: number): string {
  const a = art(order, version);
  return toUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${a.size.w} ${a.size.h}" width="${a.size.w}" height="${a.size.h}">${a.body}${watermark(a.size, version)}</svg>`);
}

/** A "photo" of the printed sample: the piece lying on the workbench. */
export function samplePhoto(order: Order): string {
  const a = art(order, Math.max(1, order.proofs.length));
  const W = 480;
  const H = 360;
  const scale = Math.min((W * 0.62) / a.size.w, (H * 0.62) / a.size.h);
  const pw = a.size.w * scale;
  const ph = a.size.h * scale;
  const x = (W - pw) / 2;
  const y = (H - ph) / 2;
  return toUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9d4cb"/><stop offset="1" stop-color="#b9b3a8"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#b)"/>
<rect x="${x + 8}" y="${y + 10}" width="${pw}" height="${ph}" fill="#000000" fill-opacity="0.22"/>
<g transform="translate(${x} ${y}) rotate(-3 ${pw / 2} ${ph / 2}) scale(${scale})">${a.body}</g>
<text x="16" y="${H - 16}" font-family="Arial, sans-serif" font-size="13" fill="#3b3b3b">Sample, 1 piece · ${escape(order.ref)}</text>
</svg>`);
}

/**
 * The design on the item (spec, "How a proof is shown": mockup), drawn simply so the customer can
 * judge size and placement: a tee, a mug, cards on a desk, a banner stand or a page. Watermarked too.
 */
export function mockupImage(order: Order, version: number): string | null {
  if (order.mechanism !== 'A') return null;
  const a = art(order, version);
  const W = 480;
  const H = 400;
  const place = (x: number, y: number, w: number, h: number) => {
    const scale = Math.min(w / a.size.w, h / a.size.h);
    const dx = x + (w - a.size.w * scale) / 2;
    const dy = y + (h - a.size.h * scale) / 2;
    return `<g transform="translate(${dx} ${dy}) scale(${scale})">${a.body}</g>`;
  };
  const garment = typeof order.brief.garmentColour === 'string' ? order.brief.garmentColour.toLowerCase() : 'white';
  const cloth = { black: '#1b1b1b', navy: '#1d2a44', grey: '#9a9a9a', red: '#b3121b', blue: '#2f5aa8' }[garment] ?? '#f4f4f2';
  let item: string;
  switch (order.product.category) {
    case 'apparel':
      item = `<path d="M150 70 L200 50 Q240 75 280 50 L330 70 L390 130 L350 165 L330 150 L330 360 L150 360 L150 150 L130 165 L90 130 Z" fill="${cloth}" stroke="#00000033" stroke-width="2"/>${place(185, 110, 110, 110)}`;
      break;
    case 'corporate-gifts':
      item = `<rect x="150" y="110" width="170" height="210" rx="14" fill="#ffffff" stroke="#00000033" stroke-width="2"/><path d="M320 160 q60 0 60 50 q0 50 -60 50" fill="none" stroke="#d8d8d8" stroke-width="18"/>${place(170, 150, 130, 130)}`;
      break;
    case 'large-format':
      item = `<rect x="190" y="30" width="100" height="330" fill="#ffffff" stroke="#00000033" stroke-width="2"/><rect x="170" y="360" width="140" height="14" rx="4" fill="#555555"/>${place(195, 35, 90, 320)}`;
      break;
    case 'stationery':
      item = `<g transform="rotate(-8 240 200)"><rect x="110" y="120" width="230" height="150" fill="#ffffff" stroke="#00000022"/>${place(110, 120, 230, 150)}</g><g transform="rotate(5 260 230)"><rect x="150" y="170" width="230" height="150" fill="#ffffff" stroke="#00000022"/>${place(150, 170, 230, 150)}</g>`;
      break;
    default:
      item = `<rect x="140" y="40" width="200" height="300" fill="#ffffff" stroke="#00000022"/>${place(150, 50, 180, 280)}`;
  }
  return toUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#ece8e1"/>${item}${watermark({ w: W, h: H }, version)}
</svg>`);
}
