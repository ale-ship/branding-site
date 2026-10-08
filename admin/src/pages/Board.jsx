import { KanbanSquare, List, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api.js';
import { ATTENTION, COLUMNS, columnOf, day, kes, when } from '../format.js';
import { PageHead, StatusPill } from '../ui.jsx';

/**
 * The order board (docs/ORDER_WORKFLOW_SPEC.md, "Staff dashboard"): Kanban by stage on a wide
 * screen, or a list; one stage at a time on a phone; search by number, name, phone or email; filter by
 * kind of order. Overdue orders are marked. Refreshes every 30 seconds.
 */
export function Board({ initialQuery = '', onAuthLost }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState(initialQuery);
  const [mechanism, setMechanism] = useState('');
  const [column, setColumn] = useState('');
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('nb-admin-board-view') ?? 'board';
    } catch {
      return 'board';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('nb-admin-board-view', view);
    } catch {
      /* private window: the choice just isn't kept */
    }
  }, [view]);

  useEffect(() => {
    let live = true;
    const load = () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (mechanism) params.set('mechanism', mechanism);
      api
        .get(`/staff/orders?${params}`)
        .then((r) => live && (setOrders(r.orders), setError('')))
        .catch((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : live && setError(e.message)));
    };
    const t = setTimeout(load, 250);
    const every = setInterval(load, 30_000);
    return () => {
      live = false;
      clearTimeout(t);
      clearInterval(every);
    };
  }, [q, mechanism, onAuthLost]);

  const byColumn = useMemo(() => {
    const groups = Object.fromEntries(COLUMNS.map(([key]) => [key, []]));
    for (const o of orders ?? []) groups[columnOf[o.status]]?.push(o);
    return groups;
  }, [orders]);
  const shown = column ? COLUMNS.filter(([key]) => key === column) : COLUMNS;
  const listed = (orders ?? []).filter((o) => !column || columnOf[o.status] === column);

  return (
    <>
      <PageHead title="Order board" crumbs={<a href="#/dashboard">Dashboard</a>}>
        Every order by stage. Open one to take its next step.
      </PageHead>

      <div className="toolbar">
        <div className="search">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="q">
            Search orders
          </label>
          <input id="q" type="search" placeholder="Order number, name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="sr-only" htmlFor="mechanism">
          Kind of order
        </label>
        <select id="mechanism" value={mechanism} onChange={(e) => setMechanism(e.target.value)}>
          <option value="">All kinds</option>
          <option value="A">Quantity runs</option>
          <option value="B">Site jobs</option>
          <option value="C">Design only</option>
        </select>
        <div className="segmented" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}>
            <KanbanSquare aria-hidden="true" /> Board
          </button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            <List aria-hidden="true" /> List
          </button>
        </div>
      </div>

      <div className="tabs" role="group" aria-label="Show one stage">
        <button type="button" aria-pressed={!column} onClick={() => setColumn('')}>
          All <span className="n">{orders?.length ?? 0}</span>
        </button>
        {COLUMNS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={column === key} onClick={() => setColumn(key)}>
            {label} <span className="n">{byColumn[key].length}</span>
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {!orders && !error && <p className="muted">Loading…</p>}

      {orders && view === 'board' && (
        <div className={`columns${column ? '' : ' kanban'}`}>
          {shown.map(([key, label]) => (
            <section key={key} className="column" aria-labelledby={`col-${key}`}>
              <h2 id={`col-${key}`}>
                <span>{label}</span>
                <span className="num">{byColumn[key].length}</span>
              </h2>
              <ul className="cards">
                {byColumn[key].map((o) => (
                  <li key={o.ref}>
                    <Card order={o} />
                  </li>
                ))}
              </ul>
              {byColumn[key].length === 0 && (
                <p className="muted" style={{ padding: '0 0.25rem' }}>
                  Nothing here.
                </p>
              )}
            </section>
          ))}
        </div>
      )}

      {orders && view === 'list' && (
        <section className="card">
          {listed.length === 0 ? (
            <p className="empty">No orders match.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Status</th>
                    <th scope="col">Due by</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Paid of total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {listed.map((o) => (
                    <tr key={o.ref} className="click" onClick={() => (window.location.hash = `#/orders/${o.ref}`)}>
                      <td>
                        <a className="ref" href={`#/orders/${o.ref}`}>
                          {o.ref}
                        </a>
                        <span className="sub">
                          {o.product.name}
                          {o.mechanism === 'A' ? ` × ${o.quantity.toLocaleString('en-KE')}` : ''}
                        </span>
                      </td>
                      <td>
                        {o.customer.company || o.customer.name}
                        <span className="sub">{when(o.createdAt)}</span>
                      </td>
                      <td>
                        <StatusPill status={o.status} />
                        {o.attention && <span className="sub">{ATTENTION[o.attention] ?? o.attention}</span>}
                      </td>
                      <td>{o.overdue ? <span className="pill red">Overdue · {day(o.dueBy)}</span> : day(o.dueBy)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {kes(o.amountPaid)}
                        <span className="sub">of {kes(o.total)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function Card({ order: o }) {
  const pieces = o.progress?.kind === 'pieces' ? o.progress : null;
  return (
    <a className={`board-card${o.overdue ? ' overdue' : ''}`} href={`#/orders/${o.ref}`}>
      <div className="line" style={{ marginTop: 0 }}>
        <span className="ref">{o.ref}</span>
        <StatusPill status={o.status} />
      </div>
      <div className="product">
        {o.product.name}
        {o.mechanism === 'A' ? ` × ${o.quantity.toLocaleString('en-KE')}` : ''}
      </div>
      <div className="line muted">
        <span>{o.customer.company || o.customer.name}</span>
        <span className="num">
          {kes(o.amountPaid)} / {kes(o.total)}
        </span>
      </div>
      <div className="line muted">
        {o.overdue ? <span className="pill red">Overdue · {day(o.dueBy)}</span> : <span>Due {day(o.dueBy)}</span>}
        {o.attention && <span className="tag red">{ATTENTION[o.attention] ?? o.attention}</span>}
      </div>
      {pieces && pieces.done > 0 && (
        <div className="mini-bar" role="img" aria-label={`${pieces.done} of ${pieces.total} done`}>
          <span style={{ width: `${(pieces.done / pieces.total) * 100}%` }} />
        </div>
      )}
    </a>
  );
}
