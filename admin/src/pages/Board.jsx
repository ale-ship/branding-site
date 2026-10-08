import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api.js';
import { ATTENTION, COLUMNS, STATUS, columnOf, day, kes } from '../format.js';

/**
 * The order board (docs/ORDER_WORKFLOW_SPEC.md, "Staff dashboard"): Kanban by status on a wide
 * screen, one column at a time on a phone; search by order number, name, phone or email; filter by
 * mechanism. Overdue orders have a red edge. Refreshes every 30 seconds.
 */
export function Board({ onAuthLost }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [mechanism, setMechanism] = useState('');
  const [column, setColumn] = useState('');

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

  return (
    <>
      <h1>Orders</h1>
      <div className="filters">
        <label className="sr-only" htmlFor="q">
          Search orders
        </label>
        <input id="q" type="search" placeholder="Order number, name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="mechanism">
          Kind of order
        </label>
        <select id="mechanism" value={mechanism} onChange={(e) => setMechanism(e.target.value)}>
          <option value="">All kinds</option>
          <option value="A">Quantity runs (A)</option>
          <option value="B">Site jobs (B)</option>
          <option value="C">Design only (C)</option>
        </select>
      </div>
      <div className="tabs" role="group" aria-label="Show one column">
        <button type="button" aria-pressed={!column} onClick={() => setColumn('')}>
          All
        </button>
        {COLUMNS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={column === key} onClick={() => setColumn(key)}>
            {label} ({byColumn[key].length})
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {!orders && !error && <p className="muted">Loading…</p>}
      {orders && (
        <div className={`columns${column ? '' : ' kanban'}`}>
          {shown.map(([key, label]) => (
            <section key={key} className="column" aria-labelledby={`col-${key}`}>
              <h2 id={`col-${key}`}>
                {label} · {byColumn[key].length}
              </h2>
              <ul className="cards">
                {byColumn[key].map((o) => (
                  <li key={o.ref}>
                    <Card order={o} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function Card({ order: o }) {
  const progress = o.progress?.kind === 'pieces' ? `${o.progress.done} / ${o.progress.total}` : null;
  return (
    <a className={`card${o.overdue ? ' overdue' : ''}`} href={`#/orders/${o.ref}`}>
      <div className="line">
        <span className="ref">{o.ref}</span>
        <span>{STATUS[o.status]}</span>
      </div>
      <div>
        {o.product.name}
        {o.mechanism === 'A' ? ` × ${o.quantity.toLocaleString('en-KE')}` : ''}
      </div>
      <div className="line muted">
        <span>{o.customer.company || o.customer.name}</span>
        {progress && <span>{progress}</span>}
      </div>
      <div className="line muted">
        <span className={o.overdue ? 'tag red' : undefined}>Due {day(o.dueBy)}</span>
        <span>
          {kes(o.amountPaid)} of {kes(o.total)}
        </span>
      </div>
      {o.attention && <span className="tag red">{ATTENTION[o.attention] ?? o.attention}</span>}
    </a>
  );
}
