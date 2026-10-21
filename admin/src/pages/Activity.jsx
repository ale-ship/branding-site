import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { kes, ROLE, when } from '../format.js';
import { PageHead } from '../ui.jsx';

/**
 * Activity (admin only; owner, 21 Oct 2026): everything the designers and the admin did, newest
 * first, from the audit log. Each person signs in with their own account, so every payment recorded,
 * proof sent and order moved shows who did it. Filter by person; older entries a page at a time.
 */

const CHANNEL = { mpesa: 'M-Pesa', bank: 'bank transfer', cash: 'cash' };

/** What happened, in words. */
const ACTION = {
  'sign-in': () => 'Signed in',
  'payment-recorded': (d) => `Recorded ${kes(d.amount)} by ${CHANNEL[d.channel] ?? d.channel}${d.reference ? ` (${d.reference})` : ''}, receipt ${d.receiptNo}`,
  'payment-assigned': () => 'Matched a Paybill payment to the order',
  'payment-refund': () => 'Marked a Paybill payment for refund',
  'attention-cleared': (d) => (d.was === 'payment-reported' ? `Couldn’t find the customer’s payment ${d.code ?? ''}; asked them to check it` : 'Cleared a flag'),
  'proof-uploaded': () => 'Sent a proof',
  'production-logged': () => 'Logged production',
  'sample-uploaded': () => 'Sent a sample photo',
  'early-delivery': () => 'Moved an early delivery on',
  'site-quote': () => 'Sent the firm quote',
  stage: () => 'Moved the job to its next stage',
  'final-file-added': () => 'Added a final file',
  'final-file-removed': () => 'Removed a final file',
  'final-files-sent': () => 'Sent the final files',
  'marked-ready': () => 'Marked it ready',
  dispatched: () => 'Sent it out for delivery',
  'handed-over': () => 'Handed it over',
  cancelled: () => 'Cancelled the order',
  'request-updated': (d) => `Updated request ${d.ref ?? ''}${d.status ? ` (${d.status.replace(/_/g, ' ')})` : ''}`,
  'staff-added': () => 'Added a staff member',
  'staff-changed': () => 'Changed a staff account',
  'prices-changed': () => 'Changed prices',
  'minimum-changed': () => 'Changed a minimum order',
};
const describe = (e) => (ACTION[e.action] ?? (() => e.action.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())))(e.detail ?? {});

export function Activity({ onAuthLost }) {
  const [people, setPeople] = useState([]);
  const [who, setWho] = useState('');
  const [entries, setEntries] = useState(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)), [onAuthLost]);

  useEffect(() => {
    api
      .get('/staff/users')
      .then((r) => setPeople(r.users))
      .catch(fail);
  }, [fail]);

  const load = useCallback(
    async (before) => {
      const params = new URLSearchParams({ ...(who ? { staff: who } : {}), ...(before ? { before: String(before) } : {}) });
      const r = await api.get(`/staff/activity?${params}`);
      setEntries((now) => (before ? [...(now ?? []), ...r.entries] : r.entries));
      setMore(r.more);
    },
    [who],
  );
  useEffect(() => {
    setEntries(null);
    load().catch(fail);
  }, [load, fail]);

  return (
    <>
      <PageHead title="Activity" crumbs={<a href="#/dashboard">Dashboard</a>}>
        Who did what, newest first: every payment recorded, proof sent and order moved, by the person signed in.
      </PageHead>
      <div className="tabs" role="group" aria-label="Show">
        <button type="button" aria-pressed={who === ''} onClick={() => setWho('')}>
          Everyone
        </button>
        {people.map((p) => (
          <button key={p.id} type="button" aria-pressed={who === String(p.id)} onClick={() => setWho(String(p.id))}>
            {p.name}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!entries && !error && <p className="muted">Loading…</p>}
      {entries?.length === 0 && <div className="card empty">Nothing yet.</div>}
      {entries && entries.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                  <th scope="col">Order</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{when(e.at)}</td>
                    <td>
                      {e.staff}
                      {e.role && <div className="muted">{ROLE[e.role]}</div>}
                    </td>
                    <td>{describe(e)}</td>
                    <td className="nowrap">{e.order ? <a href={`#/orders/${e.order}`}>{e.order}</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {more && (
        <p>
          <button type="button" onClick={() => load(entries.at(-1).id).catch(fail)}>
            Show older
          </button>
        </p>
      )}
    </>
  );
}
