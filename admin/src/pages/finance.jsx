import { Download } from 'lucide-react';
import { fileUrl } from '../api.js';

/**
 * What the reports and statements share: the period picker, and one view of a document from the API
 * (headline figures, the table, totals and note) with its PDF and CSV downloads, so the screen and
 * the files always show the same thing.
 */

/** Today in Nairobi, as YYYY-MM-DD. */
export const nairobiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());

const shift = (ymd, months) => {
  const [y, m] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 10);
};
const lastDayBefore = (ymd) => new Date(Date.parse(`${ymd}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Ready-made periods, in Nairobi days. */
export function presets() {
  const today = nairobiToday();
  const month = `${today.slice(0, 8)}01`;
  const year = `${today.slice(0, 4)}-01-01`;
  const quarter = shift(month, -((Number(today.slice(5, 7)) - 1) % 3));
  return {
    'this-month': ['This month', month, today],
    'last-month': ['Last month', shift(month, -1), lastDayBefore(month)],
    'this-quarter': ['This quarter', quarter, today],
    'this-year': ['This year', year, today],
    'last-year': ['Last year', `${Number(today.slice(0, 4)) - 1}-01-01`, lastDayBefore(year)],
  };
}

/** @param {string} key */
export const periodFor = (key) => {
  const [, from, to] = presets()[key];
  return { preset: key, from, to };
};

export function PeriodPicker({ period, onChange, idPrefix }) {
  const all = presets();
  return (
    <div className="row period">
      <div className="field">
        <label htmlFor={`${idPrefix}-preset`}>Period</label>
        <select id={`${idPrefix}-preset`} value={period.preset} onChange={(e) => e.target.value !== 'custom' && onChange(periodFor(e.target.value))}>
          {Object.entries(all).map(([key, [label]]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
          <option value="custom">Custom dates</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-from`}>From</label>
        <input
          id={`${idPrefix}-from`}
          type="date"
          value={period.from}
          max={period.to}
          onChange={(e) => e.target.value && onChange({ ...period, preset: 'custom', from: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-to`}>To</label>
        <input
          id={`${idPrefix}-to`}
          type="date"
          value={period.to}
          min={period.from}
          onChange={(e) => e.target.value && onChange({ ...period, preset: 'custom', to: e.target.value })}
        />
      </div>
    </div>
  );
}

export function Downloads({ path, params, label }) {
  return (
    <>
      <a className="button primary" href={fileUrl(path, { ...params, format: 'pdf' })} download>
        <Download aria-hidden="true" />
        PDF<span className="sr-only"> of the {label}</span>
      </a>
      <a className="button" href={fileUrl(path, { ...params, format: 'csv' })} download>
        <Download aria-hidden="true" />
        Excel (CSV)<span className="sr-only"> of the {label}</span>
      </a>
    </>
  );
}

const shortDay = (ymd) => new Date(`${ymd}T12:00:00+03:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

/** A cell as text: numbers grouped, dates in words, order numbers as links. */
function Cell({ value }) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value.toLocaleString('en-KE');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return <span className="nw">{shortDay(value)}</span>;
  if (/^\d{1,2} \w{3} \d{4}$/.test(value)) return <span className="nw">{value}</span>;
  if (/^NB-\d{6}$/.test(value))
    return (
      <a className="ref" href={`#/orders/${value}`}>
        {value}
      </a>
    );
  return value;
}

/** The headline figures and the table of a report or statement from the API. */
export function DocumentView({ doc }) {
  const right = (c) => c.money || doc.rows.some((r) => typeof r[c.key] === 'number');
  return (
    <>
      <div className="grid kpis doc-kpis">
        {doc.summary.map((s) => (
          <div key={s.label} className="card stat">
            <span className="stat-label">{s.label}</span>
            <span className="stat-value">{s.value}</span>
          </div>
        ))}
      </div>
      <section className="card">
        <div className="table-wrap">
          <table className="doc-table">
            <caption className="sr-only">
              {doc.title}, {doc.subtitle}
            </caption>
            <thead>
              <tr>
                {doc.columns.map((c) => (
                  <th key={c.key} scope="col" className={right(c) ? 'num' : undefined}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doc.rows.length === 0 && (
                <tr>
                  <td colSpan={doc.columns.length} className="empty">
                    Nothing in this period.
                  </td>
                </tr>
              )}
              {doc.rows.map((r, i) => (
                <tr key={i}>
                  {doc.columns.map((c) => (
                    <td key={c.key} className={right(c) ? 'num' : undefined}>
                      <Cell value={r[c.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {doc.totals && doc.rows.length > 0 && (
              <tfoot>
                <tr>
                  {doc.columns.map((c) => (
                    <td key={c.key} className={right(c) ? 'num' : undefined}>
                      <Cell value={doc.totals[c.key]} />
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      {doc.note && <p className="muted doc-note">{doc.note}</p>}
    </>
  );
}
