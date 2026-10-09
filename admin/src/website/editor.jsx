import { ArrowDown, ArrowUp, ExternalLink, Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, photoUrl, SITE_URL } from '../api.js';
import { when } from '../format.js';
import { PageHead } from '../ui.jsx';

/**
 * What every website editor shares: loading an item, keeping the unsaved draft, saving (or adding)
 * it, warning before changes are lost, and the page frame with its save bar and publishing panel.
 */

/** Asks before leaving with unsaved changes: closing the tab, or a link inside the back office. */
function useLeaveGuard(dirty) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const click = (e) => {
      const a = e.target.closest?.('a[href^="#/"]');
      if (a && !window.confirm('Leave without saving your changes?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', click, true);
    };
  }, [dirty]);
}

/**
 * @param {{ kind: string; slug: string | null; blank?: () => object; onAuthLost: () => void; onSaved?: (item: object, created: boolean) => void }} o
 *   `slug` null adds a new item, starting from `blank()`.
 */
export function useItem({ kind, slug, blank, onAuthLost, onSaved }) {
  const isNew = slug == null;
  const [item, setItem] = useState(isNew ? { slug: null, published: true, data: blank() } : null);
  const [draft, setDraft] = useState(item?.data ?? null);
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const saved = useRef(isNew ? null : '');

  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)), [onAuthLost]);
  const take = useCallback((it) => {
    setItem(it);
    setDraft(it.data);
    setPublished(it.published);
    saved.current = JSON.stringify([it.data, it.published]);
  }, []);
  useEffect(() => {
    if (isNew) return;
    api.get(`/staff/content/${kind}/${encodeURIComponent(slug)}`).then((r) => take(r.item), fail);
  }, [kind, slug, isNew, take, fail]);

  const dirty = draft != null && (saved.current === null || JSON.stringify([draft, published]) !== saved.current);
  useLeaveGuard(dirty);

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const body = { data: draft, published };
      const r = isNew ? await api.post(`/staff/content/${kind}`, body) : await api.put(`/staff/content/${kind}/${encodeURIComponent(item.slug)}`, body);
      take(r.item);
      setNotice(
        isNew ? 'Added. It’s on the website now.' : r.item.published ? 'Saved. The website shows it now.' : 'Saved as a draft: hidden from the website.',
      );
      onSaved?.(r.item, isNew);
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    if (!item || isNew) return;
    setDraft(item.data);
    setPublished(item.published);
  };
  const remove = async (what) => {
    if (!window.confirm(`Delete ${what}? It comes off the website at once, and this can’t be undone.`)) return false;
    try {
      await api.del(`/staff/content/${kind}/${encodeURIComponent(item.slug)}`);
      saved.current = JSON.stringify([draft, published]);
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };
  /** Sets one field of the draft (the same function each time, so effects can depend on it). */
  const setters = useRef({});
  const set = (key) => (setters.current[key] ??= (value) => setDraft((d) => ({ ...d, [key]: value })));
  return { item, draft, setDraft, set, published, setPublished, dirty, saving, error, notice, save, discard, remove, isNew };
}

/** A titled card holding one part of the form. */
export function Section({ title, children, hint, id }) {
  return (
    <section className="card form-section" aria-labelledby={id}>
      <div className="card-head">
        <div>
          <h2 id={id}>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * The editor page: a header with "View on site" and Save, the form, a side panel, and a save bar
 * that stays in view while there are unsaved changes.
 */
export function EditorShell({ ed, crumbs, title, intro, sitePath, aside, children }) {
  return (
    <form
      className="editor"
      onSubmit={(e) => {
        e.preventDefault();
        ed.save();
      }}
      noValidate
    >
      <PageHead
        crumbs={crumbs}
        title={title}
        actions={
          <>
            {sitePath && !ed.isNew && (
              <a className="button" href={`${SITE_URL}${sitePath}`} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                View on site
              </a>
            )}
            <button type="submit" className="primary" disabled={ed.saving || !ed.dirty}>
              <Save aria-hidden="true" />
              {ed.saving ? 'Saving…' : ed.isNew ? 'Add' : 'Save'}
            </button>
          </>
        }
      >
        {intro}
      </PageHead>
      {ed.notice && (
        <p className="notice" role="status">
          {ed.notice}
        </p>
      )}
      {ed.error && (
        <p className="error" role="alert">
          {ed.error}
        </p>
      )}
      {!ed.draft ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="editor-grid">
          <div className="editor-main">{children}</div>
          <aside className="editor-aside">
            {aside}
            {ed.item?.updatedAt && (
              <p className="muted small">
                Last saved {when(ed.item.updatedAt)}
                {ed.item.updatedBy ? ` by ${ed.item.updatedBy}` : ''}.
              </p>
            )}
          </aside>
        </div>
      )}
      {ed.dirty && (
        <div className="savebar" role="region" aria-label="Unsaved changes">
          <span>{ed.isNew ? 'Not added yet.' : 'You have unsaved changes.'}</span>
          {!ed.isNew && (
            <button type="button" className="ghost" onClick={ed.discard}>
              Discard
            </button>
          )}
          <button type="submit" className="primary" disabled={ed.saving}>
            {ed.saving ? 'Saving…' : ed.isNew ? 'Add' : 'Save changes'}
          </button>
        </div>
      )}
    </form>
  );
}

/** The publishing panel: shown or hidden, and delete. */
export function PublishCard({ ed, children, onDelete, what }) {
  return (
    <section className="card" aria-labelledby="publish-title">
      <h2 id="publish-title" className="aside-title">
        On the website
      </h2>
      {children}
      {onDelete && !ed.isNew && (
        <button type="button" className="ghost danger-text full" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Delete {what}
        </button>
      )}
    </section>
  );
}

/** A status pill with its words. */
export const Pill = ({ tone, children }) => <span className={`pill ${tone}`}>{children}</span>;

/**
 * A list of content (our work, the shop, services) with photos, status and order buttons.
 * @param {{ kind: string; base: string; title: string; intro: string; addLabel?: string; photoOf: (d: any) => any; lineOf: (d: any) => string; nameOf: (d: any) => string; tags?: (it: any) => any; onAuthLost: () => void; canAdd?: boolean }} p
 */
export function ContentList({ kind, base, title, intro, addLabel, photoOf, lineOf, nameOf, tags, onAuthLost, canAdd = true }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)), [onAuthLost]);
  useEffect(() => {
    api.get(`/staff/content/${kind}`).then((r) => setItems(r.items), fail);
  }, [kind, fail]);
  const move = async (i, by) => {
    const next = [...items];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setItems(next);
    try {
      setItems((await api.post(`/staff/content/${kind}/order`, { slugs: next.map((x) => x.slug) })).items);
    } catch (e) {
      fail(e);
    }
  };
  return (
    <>
      <PageHead
        title={title}
        crumbs={<a href="#/dashboard">Dashboard</a>}
        actions={
          canAdd && (
            <a className="button primary" href={`#/website/${base}/new`}>
              <Plus aria-hidden="true" />
              {addLabel}
            </a>
          )
        }
      >
        {intro}
      </PageHead>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!items && !error && <p className="muted">Loading…</p>}
      {items && (
        <ol className="content-list">
          {items.map((it, i) => (
            <li key={it.slug} className="card content-row">
              <img className="content-thumb" src={photoUrl(photoOf(it.data)?.src)} alt="" loading="lazy" />
              <div className="content-main">
                <a className="content-title" href={`#/website/${base}/${it.slug}`}>
                  {nameOf(it.data)}
                </a>
                <span className="muted">{lineOf(it.data)}</span>
                <span className="content-tags">
                  {!it.published && <Pill tone="s-closed">Draft: hidden</Pill>}
                  {tags?.(it)}
                </span>
              </div>
              <span className="muted small content-when">Saved {when(it.updatedAt)}</span>
              <span className="content-order">
                <button type="button" className="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${nameOf(it.data)} up`}>
                  <ArrowUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn small"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label={`Move ${nameOf(it.data)} down`}
                >
                  <ArrowDown aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
