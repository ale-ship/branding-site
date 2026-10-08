import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { kes, when } from '../format.js';
import { PageHead } from '../ui.jsx';
import { DocumentView, Downloads, PeriodPicker, periodFor } from './finance.jsx';

/**
 * Customer accounts (owner, 8 Oct 2026): every customer, known by the email they order with, with
 * what they were invoiced, paid and owe; and each one's statement of account, built by the same
 * rule as the statement customers see on the site.
 */
export function Accounts({ onAuthLost }) {
  const [q, setQ] = useState('');
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api
        .get(`/staff/accounts?${new URLSearchParams({ q })}`)
        .then((r) => live && setAccounts(r.accounts))
        .catch((e) => live && (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)));
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, onAuthLost]);

  const owed = accounts?.reduce((s, a) => s + Math.max(a.balance, 0), 0) ?? 0;
  const held = accounts?.reduce((s, a) => s + Math.max(-a.balance, 0), 0) ?? 0;
  const open = (a) => (window.location.hash = `#/accounts/${encodeURIComponent(a.email)}`);

  return (
    <>
      <PageHead title="Customer accounts" crumbs={<a href="#/dashboard">Dashboard</a>}>
        Every customer, known by the email they order with: what they were invoiced, what they paid and what they owe. Open one for their statement.
      </PageHead>
      {accounts && (
        <div className="grid kpis doc-kpis">
          <div className="card stat">
            <span className="stat-label">Customers{q ? ' found' : ''}</span>
            <span className="stat-value">{accounts.length.toLocaleString('en-KE')}</span>
          </div>
          <div className="card stat">
            <span className="stat-label">They owe</span>
            <span className="stat-value">{kes(owed)}</span>
          </div>
          <div className="card stat">
            <span className="stat-label">Held for them (credit or refunds)</span>
            <span className="stat-value">{kes(held)}</span>
          </div>
        </div>
      )}
      <div className="toolbar">
        <div className="search">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="accounts-q">
            Find a customer
          </label>
          <input id="accounts-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, company, email or phone" />
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!accounts && !error && <p className="muted">Loading…</p>}
      {accounts && (
        <section className="card">
          <div className="table-wrap">
            <table className="doc-table">
              <caption className="sr-only">Customer accounts</caption>
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Contact</th>
                  <th scope="col" className="num">
                    Orders
                  </th>
                  <th scope="col" className="num">
                    Invoiced
                  </th>
                  <th scope="col" className="num">
                    Paid
                  </th>
                  <th scope="col" className="num">
                    Balance
                  </th>
                  <th scope="col">Last order</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      {q ? 'No customer matches that.' : 'No customers yet.'}
                    </td>
                  </tr>
                )}
                {accounts.map((a) => (
                  <tr key={a.email} className="click" onClick={() => open(a)}>
                    <td>
                      <a className="ref" href={`#/accounts/${encodeURIComponent(a.email)}`}>
                        {a.name}
                      </a>
                      {a.company && <span className="sub">{a.company}</span>}
                    </td>
                    <td>
                      {a.email}
                      <span className="sub">{a.phone}</span>
                    </td>
                    <td className="num">{a.orders.toLocaleString('en-KE')}</td>
                    <td className="num">{a.invoiced.toLocaleString('en-KE')}</td>
                    <td className="num">{a.paid.toLocaleString('en-KE')}</td>
                    <td className="num">
                      {a.balance < 0 ? (
                        <>
                          {(-a.balance).toLocaleString('en-KE')} <span className="tag">In credit</span>
                        </>
                      ) : a.balance > 0 ? (
                        <strong>{a.balance.toLocaleString('en-KE')}</strong>
                      ) : (
                        <span className="muted">Settled</span>
                      )}
                    </td>
                    <td className="when">{when(a.lastOrder)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export function Statement({ email, onAuthLost }) {
  const [period, setPeriod] = useState(() => periodFor('this-year'));
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const params = { email, from: period.from, to: period.to };

  useEffect(() => {
    let live = true;
    setDoc(null);
    setError('');
    api
      .get(`/staff/accounts/statement?${new URLSearchParams({ email, from: period.from, to: period.to })}`)
      .then((r) => live && setDoc(r.report))
      .catch((e) => live && (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)));
    return () => {
      live = false;
    };
  }, [email, period.from, period.to, onAuthLost]);

  return (
    <>
      <PageHead
        title={doc ? doc.customer.name : 'Statement of account'}
        crumbs={
          <>
            <a href="#/dashboard">Dashboard</a> / <a href="#/accounts">Customer accounts</a>
          </>
        }
        actions={doc && <Downloads path="/staff/accounts/statement" params={params} label="statement" />}
      >
        Statement of account{doc ? ` for ${[doc.customer.company, doc.customer.email, doc.customer.phone].filter(Boolean).join(' · ')}` : ''}.
      </PageHead>
      <PeriodPicker period={period} onChange={setPeriod} idPrefix="statement" />
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
