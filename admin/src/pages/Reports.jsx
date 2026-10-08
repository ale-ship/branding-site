import { useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { PageHead } from '../ui.jsx';
import { DocumentView, Downloads, PeriodPicker, periodFor } from './finance.jsx';

/** The admin's reports (owner, 8 Oct 2026), each on screen and as PDF or CSV. */
export const REPORTS = [
  ['sales', 'Sales', 'Every invoice issued in the period, with what was paid on it and what is still owed.'],
  ['payments', 'Payments received', 'Every confirmed M-Pesa payment, with its receipt number, by prompt or Paybill.'],
  ['receivables', 'Money owed', 'Open orders that still owe money today, by how long ago they were placed.'],
  ['products', 'Sales by product', 'Orders, pieces and value per product for orders placed in the period.'],
  ['suspense', 'Paybill suspense', 'Paybill money that did not match an order by itself, and what became of it.'],
];

export function Reports({ kind, onAuthLost }) {
  const current = REPORTS.find(([k]) => k === kind) ?? REPORTS[0];
  const [key, label, about] = current;
  const [period, setPeriod] = useState(() => periodFor('this-month'));
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const asAt = key === 'receivables';
  const params = asAt ? {} : { from: period.from, to: period.to };

  useEffect(() => {
    let live = true;
    setDoc(null);
    setError('');
    api
      .get(`/staff/reports/${key}?${new URLSearchParams(asAt ? {} : { from: period.from, to: period.to })}`)
      .then((r) => live && setDoc(r.report))
      .catch((e) => live && (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)));
    return () => {
      live = false;
    };
  }, [key, asAt, period.from, period.to, onAuthLost]);

  return (
    <>
      <PageHead
        title="Reports"
        crumbs={<a href="#/dashboard">Dashboard</a>}
        actions={doc && <Downloads path={`/staff/reports/${key}`} params={params} label={`${label} report`} />}
      >
        {about}
      </PageHead>
      <nav className="tabs" aria-label="Reports">
        {REPORTS.map(([k, name]) => (
          <a key={k} href={`#/reports/${k}`} aria-current={k === key ? 'page' : undefined}>
            {name}
          </a>
        ))}
      </nav>
      {asAt ? (
        <p className="muted">{doc ? doc.subtitle : 'As at today'}: what was paid is today’s figure, so this report is always as at today.</p>
      ) : (
        <PeriodPicker period={period} onChange={setPeriod} idPrefix="report" />
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!doc && !error && <p className="muted">Loading…</p>}
      {doc && <DocumentView doc={doc} />}
    </>
  );
}
