import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { ATTENTION, day, kes, when } from '../format.js';
import { PageHead, StatusPill } from '../ui.jsx';
import { Steps } from './Steps.jsx';

/**
 * One order for staff: who, what, money, progress, the next step for this role, and everything that
 * happened, with who did it. The production logger is at the top for the workshop floor.
 */
export function OrderPage({ orderRef, staff, onAuthLost }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)), [onAuthLost]);
  useEffect(() => {
    api.get(`/staff/orders/${orderRef}`).then(setData).catch(fail);
  }, [orderRef, fail]);

  if (error && !data) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const { order: o, staff: extra } = data;

  /** Runs a step; the API answers with the order as it is now. */
  const act = async (path, body) => {
    setError('');
    try {
      setData(await api.post(`/staff/orders/${o.ref}/${path}`, body));
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  /** Uploads a proof; the API answers with the order as it is now. */
  const upload = async (file, note) => {
    setError('');
    try {
      setData(
        await api.upload(`/staff/orders/${o.ref}/proofs`, file, {
          'x-proof-note': encodeURIComponent(note),
        }),
      );
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const pieces = o.progress.kind === 'pieces' ? o.progress : null;
  return (
    <>
      <PageHead
        crumbs={
          <>
            <a href="#/dashboard">Dashboard</a> / <a href="#/orders">Order board</a> / {o.ref}
          </>
        }
        title={
          <span className="order-head">
            {o.ref} <StatusPill status={o.status} />
            {extra.attention && <span className="tag red">{ATTENTION[extra.attention] ?? extra.attention}</span>}
          </span>
        }
      >
        {o.product.name}
        {o.mechanism === 'A' ? ` × ${o.quantity.toLocaleString('en-KE')}` : ''} · {o.urgency} deadline · invoice {o.invoiceNo} · placed {when(o.createdAt)}
      </PageHead>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="grid2">
        <div>
          {pieces && (
            <section className="panel" aria-labelledby="progress-title">
              <h2 id="progress-title">
                Progress: {pieces.done} of {pieces.total}
              </h2>
              <div className="bar" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.round((pieces.done / pieces.total) * 100)}%`,
                  }}
                />
              </div>
              {o.production.promisedBy && <p className="muted">Promised for {day(o.production.promisedBy)}.</p>}
            </section>
          )}
          <Steps order={o} staff={staff} attention={extra.attention} act={act} upload={upload} />
          {o.proofs.length > 0 && <Proofs order={o} />}
          <Brief order={o} />
          <section className="panel" aria-labelledby="events-title">
            <h2 id="events-title">What’s happened</h2>
            <ol className="timeline">
              {[...o.events].reverse().map((e, i) => (
                <li key={i}>
                  {e.text}
                  <span className="when">{when(e.at)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div>
          <section className="panel" aria-labelledby="customer-title">
            <h2 id="customer-title">Customer</h2>
            <dl className="facts">
              <dt>Name</dt>
              <dd>{o.customer.name}</dd>
              {o.customer.company && (
                <>
                  <dt>Company</dt>
                  <dd>{o.customer.company}</dd>
                </>
              )}
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${o.customer.phone}`}>{o.customer.phone}</a>
              </dd>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${o.customer.email}`}>{o.customer.email}</a>
              </dd>
              <dt>Handover</dt>
              <dd>
                {o.handover.method}
                {o.handover.address ? `: ${o.handover.address}` : ''}
              </dd>
            </dl>
          </section>
          <section className="panel" aria-labelledby="money-title">
            <h2 id="money-title">Money</h2>
            <dl className="facts">
              <dt>Total</dt>
              <dd>{kes(o.total)}</dd>
              <dt>Paid</dt>
              <dd>{kes(o.amountPaid)}</dd>
              <dt>Due now</dt>
              <dd>{o.dueNow ? `${kes(o.dueNow)} (${o.duePurpose})` : 'Nothing'}</dd>
              {o.credit > 0 && (
                <>
                  <dt>Credit</dt>
                  <dd>{kes(o.credit)}</dd>
                </>
              )}
            </dl>
            {o.payments.length > 0 && (
              <ul className="timeline">
                {o.payments.map((p) => (
                  <li key={p.id}>
                    {kes(p.amount)} by {p.method === 'stk' ? 'M-Pesa prompt' : 'Paybill'} · {p.status}
                    {p.receiptNo ? ` · ${p.receiptNo}` : ''}
                    {p.mpesaReceipt ? ` (${p.mpesaReceipt})` : ''}
                    <div className="muted">{p.message ?? when(p.settledAt ?? p.requestedAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel" aria-labelledby="audit-title">
            <h2 id="audit-title">Who did what</h2>
            {extra.audit.length === 0 && <p className="muted">No staff changes yet.</p>}
            <ol className="timeline">
              {extra.audit.map((a, i) => (
                <li key={i}>
                  {a.staff ?? 'System'}: {a.action.replace(/-/g, ' ')}
                  <span className="when">{when(a.at)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

/** The brief, as answered, in plain words. */
function Brief({ order: o }) {
  const show = (v) => {
    if (Array.isArray(v)) return v.join(', ');
    if (v && typeof v === 'object')
      return 'widthCm' in v
        ? `${v.widthCm} × ${v.heightCm} cm`
        : Object.entries(v)
            .filter(([, n]) => n)
            .map(([k, n]) => `${k}: ${n}`)
            .join(', ');
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  };
  const c = o.common;
  return (
    <section className="panel" aria-labelledby="brief-title">
      <h2 id="brief-title">Brief</h2>
      <dl className="facts">
        {Object.entries(o.brief).map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{show(v)}</dd>
          </div>
        ))}
        <dt>Artwork</dt>
        <dd>{c.artwork === 'print-ready' ? 'Print-ready, from the customer' : 'Needs design'}</dd>
        {c.text && (
          <>
            <dt>Text</dt>
            <dd>{c.text}</dd>
          </>
        )}
        {c.colours.length > 0 && (
          <>
            <dt>Colours</dt>
            <dd>{c.colours.join(', ')}</dd>
          </>
        )}
        {c.assets.length > 0 && (
          <>
            <dt>Files</dt>
            <dd>{c.assets.map((f) => f.name).join(', ')}</dd>
          </>
        )}
        {c.notes && (
          <>
            <dt>Notes</dt>
            <dd>{c.notes}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

const PROOF_STATUS = {
  pending: 'With the customer',
  approved: 'Approved',
  changes_requested: 'Changes asked for',
};

/** Every proof version, newest first, with the customer's notes and pins. */
function Proofs({ order: o }) {
  return (
    <section className="panel" aria-labelledby="proofs-title">
      <h2 id="proofs-title">Proofs</h2>
      {[...o.proofs].reverse().map((p) => (
        <article key={p.version} style={{ marginBottom: '1rem' }}>
          <h3>
            v{p.version} · {PROOF_STATUS[p.status]}
          </h3>
          <p className="muted">
            Sent {when(p.uploadedAt)}
            {p.decidedAt ? ` · answered ${when(p.decidedAt)}` : ''} · <a href={`/api/staff/orders/${o.ref}/proofs/${p.version}/original`}>original file</a>
          </p>
          <img src={p.image} alt={`Proof v${p.version}, marked PROOF`} className="proof-img" />
          {p.note && <p>Note: {p.note}</p>}
          {p.comments && <p>Customer: {p.comments}</p>}
          {p.pins.length > 0 && (
            <ol>
              {p.pins.map((pin, i) => (
                <li key={i}>
                  {pin.text}
                  {pin.x !== null ? (
                    <span className="muted">
                      {' '}
                      (at {Math.round(pin.x * 100)}% across, {Math.round(pin.y * 100)}% down)
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
    </section>
  );
}
