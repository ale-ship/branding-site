// @ts-check
import { toCsv } from '../../lib/csv.js';
import { renderPdf } from '../../lib/pdf.js';

/** @typedef {import('../../lib/pdf.js').TableDocument} TableDocument */

/**
 * A table document as a file to download.
 * @param {TableDocument} doc
 * @param {'pdf' | 'csv'} format
 * @returns {Promise<{ body: Buffer | string; type: string }>}
 */
export async function asFile(doc, format) {
  if (format === 'pdf') return { body: await renderPdf(doc), type: 'application/pdf' };
  const header = doc.columns.map((c) => c.label);
  const rows = [...doc.rows, ...(doc.totals ? [doc.totals] : [])].map((r) => doc.columns.map((c) => r[c.key] ?? ''));
  return { body: toCsv([header, ...rows]), type: 'text/csv; charset=utf-8' };
}
