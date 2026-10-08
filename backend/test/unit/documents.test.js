import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../../src/lib/csv.js';
import { printable, renderPdf } from '../../src/lib/pdf.js';

/** The back office's downloads: CSV cells and the PDF renderer. */
describe('CSV', () => {
  it('quotes what needs quoting and makes formulas inert', () => {
    expect(csvCell(1500)).toBe('1500');
    expect(csvCell(null)).toBe('');
    expect(csvCell('Acme, Ltd')).toBe('"Acme, Ltd"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    for (const evil of ['=1+1', '+254722', '-2', '@SUM(A1)', '\tx']) expect(csvCell(evil).replace(/^"/, '')).toMatch(/^'/);
    expect(toCsv([['a', 'b'], [1, 'x']])).toBe(String.fromCharCode(0xfeff) + 'a,b\r\n1,x\r\n');
  });
});

describe('PDF', () => {
  it('draws only what Helvetica can, and runs a long table over several pages with page numbers', async () => {
    expect(printable('Wanjiru – “Ltd” 😀 ✓')).toBe('Wanjiru – “Ltd” ? ?');
    const rows = Array.from({ length: 120 }, (_, i) => ({ ref: `NB-${String(i).padStart(6, '0')}`, name: 'Amina Wanjiru', amount: 1000 + i }));
    const pdf = await renderPdf({
      title: 'Payments received',
      subtitle: '1 Oct 2026 to 8 Oct 2026',
      summary: [{ label: 'Received', value: 'KES 127,140' }],
      columns: [
        { key: 'ref', label: 'Order' },
        { key: 'name', label: 'Customer', weight: 2 },
        { key: 'amount', label: 'Amount (KES)', money: true },
      ],
      rows,
      totals: { ref: 'Total', amount: rows.reduce((s, r) => s + r.amount, 0) },
      note: 'A note.',
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(1);
  });
});
