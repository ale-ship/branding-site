// @ts-check

/**
 * Tables as CSV for Excel and accounting software: a byte-order mark so Excel reads UTF-8, CRLF
 * line ends, numbers as plain numbers, and text a spreadsheet would run as a formula (starting with an
 * equals, plus, minus or at sign, a tab or a carriage return) made inert with a leading apostrophe.
 */

/** Excel reads a CSV as UTF-8 only when it starts with a byte-order mark. */
const BOM = String.fromCharCode(0xfeff);

/** @param {unknown} v */
export function csvCell(v) {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const text = String(v);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * @param {unknown[][]} rows The header first.
 * @returns {string}
 */
export function toCsv(rows) {
  return BOM + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
