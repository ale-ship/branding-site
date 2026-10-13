import { Mail, MessageCircle, Phone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { day, when } from '../format.js';
import { PageHead } from '../ui.jsx';

/**
 * The inbox (B5): what the website's quote form ("ask us first") and contact form send. Every staff
 * member sees it. Reply on WhatsApp, by phone or email, then move it along: new → in progress →
 * closed, with a note for whoever picks it up next.
 */

const TABS = [
  ['new', 'New'],
  ['in_progress', 'In progress'],
  ['closed', 'Closed'],
  ['', 'All'],
];
const STATUS = { new: 'New', in_progress: 'In progress', closed: 'Closed' };
const TONE = { new: 's-new', in_progress: 's-design', closed: 's-closed' };
const FULFILMENT = { collect: 'Collect from the shop', deliver: 'Deliver', install: 'Install on site' };
const CONTACT = { whatsapp: 'WhatsApp', phone: 'a phone call', email: 'email' };

const Pill = ({ status }) => <span className={`pill ${TONE[status]}`}>{STATUS[status]}</span>;

/** Who wrote, in one line. */
const who = (r) => [r.name, r.company].filter(Boolean).join(', ');

/** The first line of what they asked, for the list. */
function gist(r) {
  if (r.kind === 'message') return r.data.message;
  const what = [r.data.serviceName || r.data.service, ...r.data.products.map((p) => `${p.name ?? p.slug} × ${p.quantity}`)].filter(Boolean).join(', ');
  return [what, r.data.details].filter(Boolean).join(': ');
}

export function Requests({ refId, onAuthLost }) {
  return refId ? <RequestPage key={refId} refId={refId} onAuthLost={onAuthLost} /> : <Inbox onAuthLost={onAuthLost} />;
}

function Inbox({ onAuthLost }) {
  const [status, setStatus] = useState('new');
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) });
    api
      .get(`/staff/requests?${params}`)
      .then((r) => setItems(r.requests))
      .catch((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)));
  }, [status, q, onAuthLost]);

  return (
    <>
      <PageHead title="Requests" crumbs={<a href="#/dashboard">Dashboard</a>}>
        Quote requests and messages from the website. Reply, then move each one along so nobody answers twice.
      </PageHead>
      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Show">
          {TABS.map(([k, name]) => (
            <button key={k || 'all'} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>
              {name}
            </button>
          ))}
        </div>
        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(String(new FormData(e.currentTarget).get('q') ?? '').trim());
          }}
        >
          <label htmlFor="requests-q" className="sr-only">
            Search requests
          </label>
          <input id="requests-q" name="q" type="search" placeholder="Name, company, phone, NQ-…" defaultValue={q} />
        </form>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {items?.length === 0 && <div className="card empty">{status === 'new' ? 'Nothing new. Every request has been picked up.' : 'Nothing here.'}</div>}
      {items && items.length > 0 && (
        <ul className="content-list">
          {items.map((r) => (
            <li key={r.ref} className="card content-row request-row">
              <div className="content-main">
                <a className="content-title" href={`#/requests/${r.ref}`}>
                  {who(r)}
                </a>
                <span className="muted">{gist(r)}</span>
                <span className="content-tags">
                  <span className="tag">{r.kind === 'quote' ? 'Quote request' : 'Message'}</span>
                  <span className="tag">{r.ref}</span>
                </span>
              </div>
              <Pill status={r.status} />
              <span className="content-when muted">{when(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** A WhatsApp, call or email link with the reference in the greeting. */
function replyLinks(r) {
  const local = r.phone.replace(/^\+/, '');
  const greeting = `Hello ${r.name.split(' ')[0]}, this is Noorcom Branding about your ${r.kind === 'quote' ? 'quote request' : 'message'} ${r.ref}.`;
  return [
    r.phone && ['WhatsApp', `https://wa.me/${local}?text=${encodeURIComponent(greeting)}`, MessageCircle],
    r.phone && ['Call', `tel:${r.phone}`, Phone],
    r.email && ['Email', `mailto:${r.email}?subject=${encodeURIComponent(`Your ${r.kind === 'quote' ? 'quote request' : 'message'} ${r.ref}`)}&body=${encodeURIComponent(greeting)}`, Mail],
  ].filter(Boolean);
}

function RequestPage({ refId, onAuthLost }) {
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)), [onAuthLost]);
  useEffect(() => {
    api
      .get(`/staff/requests/${refId}`)
      .then((x) => setR(x.request))
      .catch(fail);
  }, [refId, fail]);

  const change = async (body, done) => {
    setError('');
    try {
      setR((await api.patch(`/staff/requests/${refId}`, body)).request);
      setNotice(done);
    } catch (e) {
      fail(e);
    }
  };

  if (!r) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const d = r.data;
  return (
    <>
      <PageHead
        title={who(r)}
        crumbs={
          <>
            <a href="#/dashboard">Dashboard</a> / <a href="#/requests">Requests</a> / {r.ref}
          </>
        }
        actions={<Pill status={r.status} />}
      >
        {r.kind === 'quote' ? 'Quote request' : 'Message'} {r.ref}, sent {when(r.createdAt)}. They’d like a reply by {CONTACT[r.preferredContact]}.
      </PageHead>
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
      <div className="grid split">
        <section className="panel" aria-labelledby="asked-title">
          <h2 id="asked-title">{r.kind === 'quote' ? 'What they need' : 'Their message'}</h2>
          {r.kind === 'message' ? (
            <p className="pre">{d.message}</p>
          ) : (
            <dl className="facts">
              {d.service && (
                <>
                  <dt>Service</dt>
                  <dd>
                    {d.serviceName || d.service}
                    {d.quantity ? `, ${d.quantity.toLocaleString('en-KE')} pieces` : ''}
                  </dd>
                </>
              )}
              {d.products.length > 0 && (
                <>
                  <dt>Shop items</dt>
                  <dd>
                    {d.products.map((p) => (
                      <div key={p.slug}>
                        {p.name ?? p.slug} × {p.quantity.toLocaleString('en-KE')}
                        {Object.keys(p.options).length > 0 && <span className="muted"> ({Object.entries(p.options).map(([k, v]) => `${k}: ${v}`).join(', ')})</span>}
                      </div>
                    ))}
                  </dd>
                </>
              )}
              {d.details && (
                <>
                  <dt>Details</dt>
                  <dd className="pre">{d.details}</dd>
                </>
              )}
              <dt>Design</dt>
              <dd>{d.needsDesign ? 'They need us to design it' : 'They have artwork'}</dd>
              {d.artwork.length > 0 && (
                <>
                  <dt>Files named</dt>
                  <dd>{d.artwork.map((a) => a.name).join(', ')} (sent on WhatsApp or by email, quoting {r.ref})</dd>
                </>
              )}
              <dt>Deadline</dt>
              <dd>{d.deadline ? day(d.deadline) : 'No fixed date'}</dd>
              <dt>Handover</dt>
              <dd>
                {FULFILMENT[d.fulfilment]}
                {d.location ? `: ${d.location}` : ''}
              </dd>
            </dl>
          )}
        </section>
        <div className="stack">
          <section className="panel" aria-labelledby="reply-title">
            <h2 id="reply-title">Reply</h2>
            <dl className="facts">
              {r.phone && (
                <>
                  <dt>Phone</dt>
                  <dd>{r.phone}</dd>
                </>
              )}
              {r.email && (
                <>
                  <dt>Email</dt>
                  <dd>{r.email}</dd>
                </>
              )}
            </dl>
            <div className="quick">
              {replyLinks(r).map(([label, href, Icon]) => (
                <a key={label} className="button" href={href} target={label === 'WhatsApp' ? '_blank' : undefined} rel="noreferrer">
                  <Icon aria-hidden="true" /> {label}
                </a>
              ))}
            </div>
          </section>
          <section className="panel" aria-labelledby="status-title">
            <h2 id="status-title">Where it stands</h2>
            <div className="quick">
              {r.status !== 'in_progress' && (
                <button type="button" className={r.status === 'new' ? 'primary' : undefined} onClick={() => change({ status: 'in_progress' }, 'Marked in progress.')}>
                  {r.status === 'new' ? 'I’m on it' : 'Reopen'}
                </button>
              )}
              {r.status !== 'closed' && (
                <button type="button" onClick={() => change({ status: 'closed' }, 'Closed.')}>
                  Close
                </button>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                change({ note: String(new FormData(e.currentTarget).get('note') ?? '') }, 'Note saved.');
              }}
            >
              <div className="field">
                <label htmlFor="request-note">Note for the team</label>
                <textarea id="request-note" name="note" rows={4} maxLength={2000} defaultValue={r.note} placeholder="Called them; sent prices for 200 mugs…" />
              </div>
              <button type="submit">Save note</button>
            </form>
            {r.handledBy && <p className="muted small">Last changed by {r.handledBy}, {when(r.updatedAt)}.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
