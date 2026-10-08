import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { kes, when } from '../format.js';

const REASON = {
  'unknown-order': 'The order number in the reference doesn’t exist',
  ambiguous: 'More than one order fits the phone and amount',
  'no-match': 'No order number, and no order fits the phone and amount',
  'wrong-shortcode': 'Paid to another Paybill',
  unreadable: 'The confirmation couldn’t be read',
};

/** Paybill payments that couldn't be matched to an order: assign one, or mark it for a refund. */
export function Unmatched({ onAuthLost }) {
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)), [onAuthLost]);
  const load = useCallback(() => api.get('/staff/payments/unmatched').then((r) => setPayments(r.payments)).catch(fail), [fail]);
  useEffect(() => {
    load();
  }, [load]);

  const assign = async (e, p) => {
    e.preventDefault();
    const ref = new FormData(e.currentTarget).get('ref');
    setError('');
    try {
      const { result } = await api.post(`/staff/payments/unmatched/${p.id}/assign`, { ref });
      setNotice(`${kes(p.amount)} put on ${String(ref).toUpperCase()} (${result.split(' ').pop()}).`);
      load();
    } catch (err) {
      fail(err);
    }
  };
  const refund = async (p) => {
    if (!window.confirm(`Mark ${kes(p.amount)} from ${p.phone || 'this payer'} for a refund?`)) return;
    try {
      await api.post(`/staff/payments/unmatched/${p.id}/refund`);
      setNotice(`${kes(p.amount)} marked for a refund.`);
      load();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <>
      <h1>Unmatched payments</h1>
      <p className="muted">Paybill payments we couldn’t put on an order by themselves.</p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {payments?.length === 0 && <p>Nothing waiting.</p>}
      {payments?.map((p) => (
        <section key={p.id} className="panel" aria-label={`Payment ${p.transId}`}>
          <h2>
            {kes(p.amount)} · {p.transId}
          </h2>
          <p>
            {REASON[p.reason] ?? p.reason}. Received {when(p.receivedAt)}.
          </p>
          <dl className="facts">
            <dt>Account typed</dt>
            <dd>{p.billRef || '(empty)'}</dd>
            <dt>Payer</dt>
            <dd>{[p.payer, p.phone].filter(Boolean).join(', ') || '—'}</dd>
          </dl>
          <form className="row" onSubmit={(e) => assign(e, p)} style={{ marginTop: '0.75rem' }}>
            <div className="field">
              <label htmlFor={`ref-${p.id}`}>Put on order</label>
              <input id={`ref-${p.id}`} name="ref" placeholder="NB-123456" pattern="[Nn][Bb]-[0-9]{6}" required />
            </div>
            <button className="primary" type="submit">
              Assign
            </button>
            <button type="button" onClick={() => refund(p)}>
              Refund instead
            </button>
          </form>
        </section>
      ))}
    </>
  );
}
