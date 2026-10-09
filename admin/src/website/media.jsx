import { Check, Search, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ApiError, api } from '../api.js';
import { when } from '../format.js';
import { PageHead } from '../ui.jsx';

/**
 * The media library: every photo staff upload for the website. Uploads are cleaned and resized by
 * the API (no location data; at most 2400 px). A photo the site shows can't be deleted.
 */

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
const MB = 1024 * 1024;
const size = (b) => (b >= MB ? `${(b / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** The library, with search and uploads. */
function useLibrary(onAuthLost) {
  const [media, setMedia] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(0);
  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost?.() : setError(e.message)), [onAuthLost]);
  const load = useCallback(() => api.get(`/staff/media?${new URLSearchParams({ q })}`).then((r) => setMedia(r.media), fail), [q, fail]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);
  /** Uploads files one by one; answers the ones that made it. */
  const upload = async (files) => {
    setError('');
    const done = [];
    for (const file of files) {
      if (file.size > 15 * MB) {
        setError(`${file.name} is over 15 MB.`);
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const alt = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
        const { media: m } = await api.upload(`/staff/media?${new URLSearchParams({ filename: file.name, alt })}`, file);
        done.push(m);
      } catch (e) {
        fail(e);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (done.length) setMedia((all) => [...done.reverse(), ...(all ?? [])]);
    return done;
  };
  return { media, setMedia, q, setQ, error, setError, busy, upload, fail };
}

function UploadButton({ upload, busy, label = 'Upload photos' }) {
  const input = useRef(null);
  return (
    <>
      <button type="button" className="primary" onClick={() => input.current?.click()} disabled={busy > 0}>
        <Upload aria-hidden="true" />
        {busy > 0 ? `Uploading ${busy}…` : label}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          upload([...e.target.files]);
          e.target.value = '';
        }}
      />
    </>
  );
}

/** Drop files anywhere on it to upload them. */
function DropZone({ upload, children }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        upload([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
      }}
    >
      {children}
    </div>
  );
}

function SearchBox({ q, setQ, id }) {
  return (
    <div className="search">
      <Search aria-hidden="true" />
      <label className="sr-only" htmlFor={id}>
        Find a photo
      </label>
      <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="File name or description" />
    </div>
  );
}

/** The media library page (Website → Media library). */
export function MediaLibrary({ me, onAuthLost }) {
  const lib = useLibrary(onAuthLost);
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(null);
  const canEdit = me.role === 'admin' || me.role === 'designer';

  const saveAlt = async (m, alt) => {
    try {
      const { media } = await api.patch(`/staff/media/${m.id}`, { alt });
      lib.setMedia((all) => all.map((x) => (x.id === m.id ? media : x)));
      setNotice('Description saved.');
    } catch (e) {
      lib.fail(e);
    }
  };
  const remove = async (m) => {
    if (!window.confirm(`Delete ${m.filename}? This can’t be undone.`)) return;
    try {
      await api.del(`/staff/media/${m.id}`);
      lib.setMedia((all) => all.filter((x) => x.id !== m.id));
      setOpen(null);
      setNotice(`${m.filename} deleted.`);
    } catch (e) {
      lib.fail(e);
    }
  };

  return (
    <>
      <PageHead
        title="Media library"
        crumbs={<a href="#/dashboard">Dashboard</a>}
        actions={
          canEdit && (
            <UploadButton
              upload={(f) => lib.upload(f).then((d) => d.length && setNotice(`${d.length} photo${d.length > 1 ? 's' : ''} uploaded.`))}
              busy={lib.busy}
            />
          )
        }
      >
        Photos for the website. Each upload is turned the right way up, cleared of where and how it was taken, and made light enough for phones.
      </PageHead>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {lib.error && (
        <p className="error" role="alert">
          {lib.error}
        </p>
      )}
      <div className="toolbar">
        <SearchBox q={lib.q} setQ={lib.setQ} id="library-q" />
      </div>
      <DropZone upload={(f) => lib.upload(f)}>
        {!lib.media && <p className="muted">Loading…</p>}
        {lib.media?.length === 0 && (
          <div className="card empty">
            <p>{lib.q ? 'No photo matches that.' : 'No photos yet. Upload some, or drop them here.'}</p>
          </div>
        )}
        <ul className="media-grid">
          {lib.media?.map((m) => (
            <li key={m.id}>
              <button type="button" className="media-tile" onClick={() => setOpen(m)} aria-label={`${m.alt || m.filename}: details`}>
                <img src={m.thumb} alt="" loading="lazy" />
              </button>
              <span className="media-name">{m.filename}</span>
            </li>
          ))}
        </ul>
      </DropZone>
      {open && (
        <MediaDetails
          m={open}
          canEdit={canEdit}
          onClose={() => setOpen(null)}
          onSave={(alt) => saveAlt(open, alt).then(() => setOpen(null))}
          onDelete={() => remove(open)}
        />
      )}
    </>
  );
}

/** A modal dialog that keeps focus inside and closes with Escape. */
export function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className={`dialog${wide ? ' wide' : ''}`} aria-labelledby={id} onCancel={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="dialog-head">
        <h2 id={id}>{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}

function MediaDetails({ m, canEdit, onClose, onSave, onDelete }) {
  const [alt, setAlt] = useState(m.alt);
  return (
    <Dialog title={m.filename} onClose={onClose}>
      <img className="media-big" src={m.src} alt={m.alt} />
      <p className="muted">
        {m.width} × {m.height} px · {size(m.bytes)} · uploaded {when(m.uploadedAt)}
        {m.uploadedBy ? ` by ${m.uploadedBy}` : ''}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(alt);
        }}
      >
        <div className="field">
          <label htmlFor="media-alt">Description</label>
          <input id="media-alt" value={alt} maxLength={300} onChange={(e) => setAlt(e.target.value)} disabled={!canEdit} aria-describedby="media-alt-hint" />
          <p className="hint" id="media-alt-hint">
            Used when this photo is picked for a page. Each page keeps its own copy, so change it there too.
          </p>
        </div>
        {canEdit && (
          <div className="row">
            <button type="submit" className="primary">
              Save description
            </button>
            <button type="button" className="ghost danger-text" onClick={onDelete}>
              <Trash2 aria-hidden="true" />
              Delete photo
            </button>
          </div>
        )}
      </form>
    </Dialog>
  );
}

/** Choose a photo for a page, or upload one and choose it. */
export function MediaPicker({ onPick, onClose }) {
  const lib = useLibrary();
  const [chosen, setChosen] = useState(null);
  return (
    <Dialog title="Choose a photo" onClose={onClose} wide>
      <div className="toolbar">
        <SearchBox q={lib.q} setQ={lib.setQ} id="picker-q" />
        <UploadButton
          label="Upload new"
          busy={lib.busy}
          upload={async (f) => {
            const done = await lib.upload(f);
            if (done.length === 1) setChosen(done[0]);
          }}
        />
      </div>
      {lib.error && (
        <p className="error" role="alert">
          {lib.error}
        </p>
      )}
      <DropZone upload={lib.upload}>
        {!lib.media && <p className="muted">Loading…</p>}
        {lib.media?.length === 0 && <p className="muted">No photos yet. Upload one, or drop it here.</p>}
        <ul className="media-grid picker" aria-label="Photos">
          {lib.media?.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={`media-tile${chosen?.id === m.id ? ' chosen' : ''}`}
                onClick={() => setChosen(m)}
                onDoubleClick={() => onPick(m)}
                aria-pressed={chosen?.id === m.id}
                aria-label={m.alt || m.filename}
              >
                <img src={m.thumb} alt="" loading="lazy" />
                {chosen?.id === m.id && (
                  <span className="tick" aria-hidden="true">
                    <Check />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </DropZone>
      <div className="dialog-foot">
        <span className="muted">{chosen ? chosen.filename : 'Pick a photo'}</span>
        <button type="button" className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary" disabled={!chosen} onClick={() => onPick(chosen)}>
          Use this photo
        </button>
      </div>
    </Dialog>
  );
}
