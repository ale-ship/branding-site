/**
 * Draws the contour lines (owner, 9 Oct 2026: the back office's topographic lines, on the site too)
 * into public/contours as SVG files. The site uses them as CSS masks (globals.css, `.contour-*`), so
 * the lines take their colour from our tokens and the files are cached once for every page:
 *
 *   field.svg   faint hills across a wide frame, every line at full strength (the colour sets how faint)
 *   hill.svg    one hill whose lines fade from a strong centre, for the red accent
 *
 * The same drawing as the back office's admin/src/contours.jsx. Run with: npm run contours
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'contours');
mkdirSync(out, { recursive: true });

/** One closed contour line: a circle whose radius wanders with a few slow waves, smoothed. */
function ring(cx, cy, r, seed, squash = 0.7, points = 36) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 + 0.09 * Math.sin(3 * a + seed) + 0.06 * Math.sin(5 * a + seed * 1.7) + 0.04 * Math.sin(2 * a - seed * 0.6);
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * squash]);
  }
  const p = (i) => pts[(i + pts.length) % pts.length];
  const f = (n) => Math.round(n);
  let d = `M${f(p(0)[0])} ${f(p(0)[1])}`;
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><g fill="none" stroke="#000" stroke-width="1.4" vector-effect="non-scaling-stroke">${body}</g></svg>\n`;

// A wide field of faint hills.
const field = [
  [1180, 140, 11, 38, 1.3],
  [200, 760, 10, 40, 4.1],
  [700, 430, 13, 46, 2.2],
  [1380, 820, 6, 40, 5.4],
  [60, 80, 6, 38, 0.4],
]
  .flatMap(([cx, cy, n, gap, seed]) => Array.from({ length: n }, (_, i) => `<path d="${ring(cx, cy, 18 + i * gap, seed + i * 0.35)}"/>`))
  .join('');
writeFileSync(join(out, 'field.svg'), svg(1440, 900, field));

// One hill, strongest at its centre.
const hill = Array.from({ length: 12 }, (_, i) => {
  const opacity = Math.max(0.12, 1 - i * 0.08).toFixed(2);
  const width = i < 3 ? ' stroke-width="2"' : '';
  return `<path d="${ring(400, 400, 16 + i * 30, 1.3 + i * 0.35, 0.75)}" stroke-opacity="${opacity}"${width}/>`;
}).join('');
writeFileSync(join(out, 'hill.svg'), svg(800, 800, hill));

console.log('Wrote public/contours/field.svg and hill.svg');
