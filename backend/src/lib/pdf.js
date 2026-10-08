// @ts-check
import PDFDocument from 'pdfkit';
import { INK, LETTERHEAD } from './letterhead.js';

/**
 * A report or statement as an A4 PDF, in the look of Noorcom's invoices: the red bar, the logo, the
 * title and period, a row of headline figures, then the table (its header repeated on every page),
 * the totals and a note, with the company and "Page x of y" at the foot of each page.
 *
 * @typedef {string | number | null | undefined} Cell
 * @typedef {{ key: string; label: string; money?: boolean; weight?: number }} Column
 * @typedef {{
 *   title: string;
 *   subtitle: string;
 *   meta?: [string, string][];
 *   summary: { label: string; value: string }[];
 *   columns: Column[];
 *   rows: Record<string, Cell>[];
 *   totals?: Record<string, Cell> | null;
 *   note?: string;
 *   landscape?: boolean;
 * }} TableDocument
 */

const number = new Intl.NumberFormat('en-KE');

/** Characters Helvetica's encoding (WinAnsi) has beyond Latin-1; anything else prints as "?". */
const WIN_ANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
/** @param {string} s */
export const printable = (s) =>
  [...s]
    .map((ch) => {
      const c = /** @type {number} */ (ch.codePointAt(0));
      return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI.includes(ch) ? ch : '?';
    })
    .join('');

/** @param {Cell} v */
const cellText = (v) => (v == null || v === '' ? '' : typeof v === 'number' ? number.format(v) : printable(String(v)));

/** @param {Date} d */
const stamp = (d) =>
  d.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * @param {TableDocument} report
 * @param {Date} [now]
 * @returns {Promise<Buffer>}
 */
export function renderPdf(report, now = new Date()) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: report.landscape ? 'landscape' : 'portrait',
    margins: { top: 40, bottom: 56, left: 40, right: 40 },
    bufferPages: true,
    info: { Title: printable(report.title), Author: LETTERHEAD.legalName, Creator: 'Noorcom Branding back office' },
  });
  /** @type {Buffer[]} */
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  // The letterhead: red bar, logo, and the title with its period on the right.
  doc.rect(0, 0, doc.page.width, 6).fill(INK.red);
  doc.image(LETTERHEAD.logo, left, 22, { height: 58 });
  doc.font('Helvetica-Bold').fontSize(18).fillColor(INK.heading).text(printable(report.title), left + 100, 26, { width: width - 100, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor(INK.body).text(printable(report.subtitle), { width: width - 100, align: 'right' });
  doc.fontSize(8).fillColor(INK.muted).text(`Printed ${stamp(now)}`, { width: width - 100, align: 'right' });
  let y = 92;
  doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor(INK.border).stroke();
  y += 14;

  // Who it is for (statements).
  for (const [label, value] of report.meta ?? []) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(INK.heading).text(printable(label), left, y, { width: 90 });
    doc.font('Helvetica').fillColor(INK.body).text(printable(value), left + 90, y, { width: width - 90 });
    y = Math.max(y + 13, doc.y + 2);
  }
  if (report.meta?.length) y += 8;

  // The headline figures, in a row of tinted boxes.
  if (report.summary.length) {
    const gap = 8;
    const w = (width - gap * (report.summary.length - 1)) / report.summary.length;
    report.summary.forEach((s, i) => {
      const x = left + i * (w + gap);
      doc.rect(x, y, w, 46).fill(INK.panel);
      doc.font('Helvetica').fontSize(7).fillColor(INK.muted).text(printable(s.label.toUpperCase()), x + 8, y + 8, { width: w - 16, height: 10, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(INK.heading).text(printable(s.value), x + 8, y + 22, { width: w - 16, height: 16, ellipsis: true });
    });
    y += 46 + 18;
  }

  // The table.
  const pad = 4;
  const total = report.columns.reduce((s, c) => s + (c.weight ?? 1), 0);
  // Money and counts sit on the right, headers too.
  const cols = report.columns.map((c) => ({ ...c, w: (width * (c.weight ?? 1)) / total, right: c.money || report.rows.some((r) => typeof r[c.key] === 'number') }));
  const alignOf = (/** @type {Column} */ c, /** @type {Cell} */ v) => (c.money || typeof v === 'number' ? 'right' : 'left');

  /** @param {Record<string, Cell>} row @param {'Helvetica' | 'Helvetica-Bold'} font */
  const rowHeight = (row, font) => {
    doc.font(font).fontSize(8);
    return Math.max(...cols.map((c) => doc.heightOfString(cellText(row[c.key]) || ' ', { width: c.w - 2 * pad }))) + 2 * pad;
  };
  const header = () => {
    doc.font('Helvetica-Bold').fontSize(7.5);
    const h = Math.max(...cols.map((c) => doc.heightOfString(c.label, { width: c.w - 2 * pad }))) + 2 * pad;
    let x = left;
    for (const c of cols) {
      doc.fillColor(INK.muted).text(printable(c.label), x + pad, y + pad, { width: c.w - 2 * pad, align: c.right ? 'right' : 'left' });
      x += c.w;
    }
    y += h;
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.8).strokeColor(INK.heading).stroke();
  };
  /** @param {Record<string, Cell>} row @param {{ bold?: boolean; shade?: boolean }} how */
  const draw = (row, { bold = false, shade = false }) => {
    const font = bold ? 'Helvetica-Bold' : 'Helvetica';
    const h = rowHeight(row, font);
    if (y + h > bottom()) {
      doc.addPage();
      y = doc.page.margins.top;
      header();
    }
    if (shade) doc.rect(left, y, width, h).fill(INK.panel);
    if (bold) doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.8).strokeColor(INK.heading).stroke();
    let x = left;
    doc.font(font).fontSize(8).fillColor(INK.body);
    for (const c of cols) {
      doc.fillColor(bold ? INK.heading : INK.body).text(cellText(row[c.key]), x + pad, y + pad, { width: c.w - 2 * pad, align: alignOf(c, row[c.key]) });
      x += c.w;
    }
    y += h;
  };

  header();
  if (!report.rows.length) {
    doc.font('Helvetica').fontSize(9).fillColor(INK.muted).text('Nothing in this period.', left + pad, y + 8, { width });
    y += 24;
  }
  report.rows.forEach((row, i) => draw(row, { shade: i % 2 === 1 }));
  if (report.totals) draw(report.totals, { bold: true });

  if (report.note) {
    doc.font('Helvetica').fontSize(8);
    const h = doc.heightOfString(printable(report.note), { width });
    if (y + 12 + h > bottom()) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.fillColor(INK.muted).text(printable(report.note), left, y + 12, { width });
  }

  // The foot of every page (drawn in the bottom margin, so lift the margin while writing it).
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    const keep = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 36;
    doc.moveTo(left, fy - 8).lineTo(left + width, fy - 8).lineWidth(0.5).strokeColor(INK.border).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(INK.muted);
    doc.text(`${LETTERHEAD.legalName} · ${LETTERHEAD.tagline} · ${LETTERHEAD.phone} · ${LETTERHEAD.email}`, left, fy, { width: width - 80, lineBreak: false });
    doc.text(`Page ${i - start + 1} of ${count}`, left + width - 80, fy, { width: 80, align: 'right', lineBreak: false });
    doc.page.margins.bottom = keep;
  }
  doc.end();
  return done;
}
