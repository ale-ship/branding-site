import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, photoUrl } from '../api.js';
import { PageHead } from '../ui.jsx';
import { Text } from './fields.jsx';
import { MediaPicker } from './media.jsx';

/**
 * The clients on the logo ticker (home and About pages): a name, and a logo when there is one
 * (without one, the name shows instead). Each row saves on its own.
 */
export function ClientsPage({ onAuthLost }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)), [onAuthLost]);
  const load = useCallback(() => api.get('/staff/content/client').then((r) => setItems(r.items), fail), [fail]);
  useEffect(() => {
    load();
  }, [load]);

  const done = (text) => {
    setError('');
    setNotice(text);
  };
  const add = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get('name') ?? '').trim();
    if (!name) return;
    try {
      await api.post('/staff/content/client', { data: { name, logo: null }, published: true });
      form.reset();
      done(`${name} added. Add their logo below.`);
      load();
    } catch (err) {
      fail(err);
    }
  };
  const save = async (it, data, published = it.published) => {
    try {
      const { item } = await api.put(`/staff/content/client/${it.slug}`, { data, published });
      setItems((all) => all.map((x) => (x.slug === it.slug ? item : x)));
      done(`${data.name} saved.`);
    } catch (err) {
      fail(err);
    }
  };
  const remove = async (it) => {
    if (!window.confirm(`Remove ${it.data.name} from the website?`)) return;
    try {
      await api.del(`/staff/content/client/${it.slug}`);
      done(`${it.data.name} removed.`);
      load();
    } catch (err) {
      fail(err);
    }
  };
  const move = async (i, by) => {
    const next = [...items];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setItems(next);
    try {
      setItems((await api.post('/staff/content/client/order', { slugs: next.map((x) => x.slug) })).items);
    } catch (err) {
      fail(err);
    }
  };

  return (
    <>
      <PageHead title="Clients" crumbs={<a href="#/dashboard">Dashboard</a>}>
        The logos on the ticker on the home and About pages. Only show a client’s logo with their permission.
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
      <form className="card row" onSubmit={add}>
        <div className="field">
          <label htmlFor="client-name">Add a client</label>
          <input id="client-name" name="name" maxLength={80} required placeholder="Company name" />
        </div>
        <button type="submit" className="primary">
          <Plus aria-hidden="true" />
          Add
        </button>
      </form>
      {!items && !error && <p className="muted">Loading…</p>}
      <ol className="client-list">
        {items?.map((it, i) => (
          <ClientRow
            key={it.slug}
            it={it}
            first={i === 0}
            last={i === items.length - 1}
            onSave={(data, published) => save(it, data, published)}
            onRemove={() => remove(it)}
            onMove={(by) => move(i, by)}
          />
        ))}
      </ol>
    </>
  );
}

function ClientRow({ it, first, last, onSave, onRemove, onMove }) {
  const [name, setName] = useState(it.data.name);
  const [picking, setPicking] = useState(false);
  const changed = name.trim() !== it.data.name;
  // The logo is described by the client's name, as the site shows it.
  const setLogo = (src) => onSave({ name: it.data.name, logo: src ? { src, alt: it.data.name } : null });
  return (
    <li className="card client-row">
      <div className="client-logo">
        <button
          type="button"
          className="photo-preview logo"
          onClick={() => setPicking(true)}
          aria-label={it.data.logo ? `Change ${it.data.name}’s logo` : `Add ${it.data.name}’s logo`}
        >
          {it.data.logo ? <img src={photoUrl(it.data.logo.src)} alt="" /> : <ImagePlus aria-hidden="true" />}
        </button>
        {it.data.logo ? (
          <button type="button" className="ghost small-btn" onClick={() => setLogo(null)}>
            Remove logo
          </button>
        ) : (
          <span className="muted small">No logo: the name shows.</span>
        )}
      </div>
      {picking && (
        <MediaPicker
          onClose={() => setPicking(false)}
          onPick={(m) => {
            setPicking(false);
            setLogo(m.src);
          }}
        />
      )}
      <div className="client-side">
        <form
          className="row tight"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ ...it.data, name: name.trim() });
          }}
        >
          <Text label="Name" value={name} onChange={setName} maxLength={80} />
          {changed && (
            <button type="submit" className="primary">
              Save name
            </button>
          )}
        </form>
        <div className="row tight">
          <label className="inline-check">
            <input type="checkbox" checked={it.published} onChange={(e) => onSave(it.data, e.target.checked)} />
            Show on the website
          </label>
          <span className="spacer" />
          <button type="button" className="icon-btn small" onClick={() => onMove(-1)} disabled={first} aria-label={`Move ${it.data.name} up`}>
            <ArrowUp aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn small" onClick={() => onMove(1)} disabled={last} aria-label={`Move ${it.data.name} down`}>
            <ArrowDown aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn small danger" onClick={onRemove} aria-label={`Remove ${it.data.name}`}>
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}
