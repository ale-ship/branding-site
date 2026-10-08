import { AlertTriangle, Banknote, CheckCircle2, Clock, CreditCard, Factory, Flag, PackageCheck, PenTool, ShoppingBag, Truck, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { day, kes, when } from '../format.js';
import { PageHead, Stat, StatusPill, Trend } from '../ui.jsx';
import { RevenueChart } from './RevenueChart.jsx';

const STAGES = [
  ['new', 'Awaiting payment', Wallet],
  ['design', 'In design', PenTool],
  ['approval', 'Approval and balance', CheckCircle2],
  ['production', 'In production', Factory],
  ['ready', 'Ready', PackageCheck],
  ['out', 'Out for handover', Truck],
  ['done', 'Done', Flag],
];

/**
 * The back office's home: this month's money and orders against the same days last month, the last
 * 30 days of payments, where orders are, what needs a hand, what sells, and the newest orders.
 */
export function Dashboard({ onAuthLost }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const load = () =>
      api
        .get('/staff/dashboard')
        .then((r) => live && setD(r))
        .catch((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : live && setError(e.message)));
    load();
    const every = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(every);
    };
  }, [onAuthLost]);

  if (error && !d) return <p className="error">{error}</p>;
  if (!d) return <p className="muted">Loading…</p>;
  const thirty = d.revenueByDay.reduce((n, x) => n + x.amount, 0);
  const maxCat = Math.max(1, ...d.byCategory.map((c) => c.value));
  const month = new Date(`${d.today}T12:00:00+03:00`).toLocaleDateString('en-KE', { month: 'long' });

  return (
    <>
      <PageHead title="Dashboard">How the workshop is doing in {month}, and what needs a hand today.</PageHead>

      <div className="grid kpis">
        <Stat
          label={`Received in ${month}`}
          value={kes(d.month.revenue)}
          icon={Banknote}
          tone="red"
          note={<Trend now={d.month.revenue} before={d.lastMonth.revenue} label="vs last month" />}
        />
        <Stat
          label={`Orders in ${month}`}
          value={d.month.orders.toLocaleString('en-KE')}
          icon={ShoppingBag}
          note={<Trend now={d.month.orders} before={d.lastMonth.orders} label="vs last month" />}
        />
        <Stat
          label="Waiting for payment"
          value={kes(d.awaiting.amount)}
          icon={Clock}
          note={`${d.awaiting.orders} ${d.awaiting.orders === 1 ? 'order' : 'orders'}`}
          href="#/orders"
        />
        <Stat
          label="Needs a hand"
          value={(d.overdue + d.attention + d.unmatched).toLocaleString('en-KE')}
          icon={AlertTriangle}
          tone={d.overdue + d.attention + d.unmatched ? 'red' : undefined}
          note={`${d.overdue} overdue · ${d.attention} flagged · ${d.unmatched} unmatched payments`}
          href={d.unmatched ? '#/payments' : '#/orders'}
        />
      </div>

      <div className="grid split">
        <section className="card" aria-labelledby="revenue-title">
          <div className="card-head">
            <div>
              <h2 id="revenue-title">Money received</h2>
              <p>Last 30 days, by M-Pesa prompt and Paybill</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="stat-value num" style={{ fontSize: '1.25rem' }}>
                {kes(thirty)}
              </div>
              <span className="muted">in 30 days</span>
            </div>
          </div>
          <RevenueChart data={d.revenueByDay} />
        </section>

        <section className="card" aria-labelledby="cat-title">
          <div className="card-head">
            <div>
              <h2 id="cat-title">Orders by category</h2>
              <p>Value placed in {month}</p>
            </div>
          </div>
          {d.byCategory.length === 0 ? (
            <p className="empty">No orders yet this month.</p>
          ) : (
            <ul className="bars">
              {d.byCategory.map((c) => (
                <li key={c.category}>
                  <div className="bar-label">
                    <strong>{c.category}</strong>
                    <span className="num">
                      {kes(c.value)} · {c.orders} {c.orders === 1 ? 'order' : 'orders'}
                    </span>
                  </div>
                  <div className="track" aria-hidden="true">
                    <div
                      className="fill"
                      style={{
                        width: `${Math.max(2, (c.value / maxCat) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="pipe-title" style={{ marginBottom: '1rem' }}>
        <h2 id="pipe-title" style={{ marginBottom: '0.75rem' }}>
          Order pipeline
        </h2>
        <div className="pipeline">
          {STAGES.map(([key, label, Icon]) => (
            <a key={key} className="stage" href="#/orders">
              <span className="stat-icon" aria-hidden="true">
                <Icon />
              </span>
              <strong>{d.stages[key] ?? 0}</strong>
              <span>{label}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="recent-title">
        <div className="card-head">
          <div>
            <h2 id="recent-title">Newest orders</h2>
            <p>The latest eight, newest first</p>
          </div>
          <a className="button" href="#/orders">
            <CreditCard aria-hidden="true" />
            All orders
          </a>
        </div>
        {d.recent.length === 0 ? (
          <p className="empty">No orders yet.</p>
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
                {d.recent.map((o) => (
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
    </>
  );
}
