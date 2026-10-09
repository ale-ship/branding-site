import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useId, useState } from 'react';
import { photoUrl } from '../api.js';
import { MediaPicker } from './media.jsx';

/**
 * The website editor's form pieces: every field has a visible label and its hint read out with it;
 * lists can be added to, removed from and reordered with buttons (no dragging needed).
 */

function Hint({ id, children }) {
  return children ? (
    <p className="hint" id={id}>
      {children}
    </p>
  ) : null;
}

export function Text({ label, value, onChange, hint, multiline = false, rows = 4, maxLength, required = true, placeholder }) {
  const id = useId();
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {!required && <span className="optional"> (optional)</span>}
      </label>
      <Tag
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...(multiline ? { rows } : { type: 'text' })}
      />
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </div>
  );
}

export function Num({ label, value, onChange, min, max, hint, suffix }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="with-suffix">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          step="1"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
          required
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {suffix && <span aria-hidden="true">{suffix}</span>}
      </div>
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </div>
  );
}

/** An on/off switch. */
export function Toggle({ label, checked, onChange, hint }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div>
        <label htmlFor={id}>{label}</label>
        <Hint id={`${id}-hint`}>{hint}</Hint>
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
    </div>
  );
}

export function Choice({ label, value, options, onChange, hint }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </div>
  );
}

/** Several choices as tick-box chips. */
export function Chips({ legend, options, value, onChange, hint }) {
  const id = useId();
  const flip = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className="field chips" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend>{legend}</legend>
      <div className="chip-row">
        {options.map(([v, l]) => (
          <label key={v} className="chip">
            <input type="checkbox" checked={value.includes(v)} onChange={() => flip(v)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </fieldset>
  );
}

/** A list of short words or lines: type and press Enter to add. */
export function Tags({ label, value, onChange, hint, placeholder = 'Type and press Enter', max = 20 }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v) && value.length < max) onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {value.length > 0 && (
        <ul className="tag-list" aria-label={label}>
          {value.map((t, i) => (
            <li key={t + i}>
              {t}
              <button type="button" className="tag-x" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${t}`}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row tight">
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button type="button" onClick={add} disabled={!draft.trim() || value.length >= max}>
          <Plus aria-hidden="true" />
          Add
        </button>
      </div>
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </div>
  );
}

/** A list of things with the same fields: add, remove and move each. */
export function Repeater({ legend, items, onChange, make, render, addLabel, min = 0, max = 20, itemName = 'Item', hint }) {
  const set = (i, next) => onChange(items.map((x, j) => (j === i ? next : x)));
  const move = (i, by) => {
    const next = [...items];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };
  return (
    <fieldset className="repeater">
      <legend>{legend}</legend>
      {hint && <p className="hint">{hint}</p>}
      <ol>
        {items.map((item, i) => (
          <li key={i} className="repeat-item">
            <div className="repeat-head">
              <span className="repeat-n">
                {itemName} {i + 1}
              </span>
              <span className="repeat-tools">
                <button
                  type="button"
                  className="icon-btn small"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${itemName.toLowerCase()} ${i + 1} up`}
                >
                  <ArrowUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn small"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label={`Move ${itemName.toLowerCase()} ${i + 1} down`}
                >
                  <ArrowDown aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn small danger"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  disabled={items.length <= min}
                  aria-label={`Remove ${itemName.toLowerCase()} ${i + 1}`}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </span>
            </div>
            {render(item, (next) => set(i, next), i)}
          </li>
        ))}
      </ol>
      {items.length < max && (
        <button type="button" className="add-btn" onClick={() => onChange([...items, make()])}>
          <Plus aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </fieldset>
  );
}

/**
 * One photo: a preview, a button to choose from the media library (or upload), and the words that
 * describe it for people who can't see it.
 */
export function Photo({ label, value, onChange, optional = false, hint, caption = false }) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="photo-field">
      <div className="photo-label">{label}</div>
      <div className="photo-body">
        <button
          type="button"
          className="photo-preview"
          onClick={() => setPicking(true)}
          aria-label={value ? `Change ${label.toLowerCase()}` : `Choose ${label.toLowerCase()}`}
        >
          {value ? <img src={photoUrl(value.src)} alt="" /> : <ImagePlus aria-hidden="true" />}
        </button>
        <div className="photo-side">
          {value ? (
            <>
              <Text
                label="Describe the photo"
                value={value.alt}
                onChange={(alt) => onChange({ ...value, alt })}
                maxLength={300}
                hint="For people who can’t see it, and for Google."
              />
              {caption && (
                <Text label="Caption" value={value.caption ?? ''} onChange={(c) => onChange({ ...value, caption: c })} maxLength={200} required={false} />
              )}
              <div className="row tight">
                <button type="button" onClick={() => setPicking(true)}>
                  Change photo
                </button>
                {optional && (
                  <button type="button" className="ghost" onClick={() => onChange(null)}>
                    Remove
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {hint && <p className="hint">{hint}</p>}
              <button type="button" className="primary" onClick={() => setPicking(true)}>
                <ImagePlus aria-hidden="true" />
                Choose a photo
              </button>
            </>
          )}
        </div>
      </div>
      {picking && (
        <MediaPicker
          onClose={() => setPicking(false)}
          onPick={(m) => {
            onChange({ ...(value ?? {}), src: m.src, alt: value?.alt && value.src === m.src ? value.alt : m.alt || value?.alt || '' });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

/** A list of photos, each with an optional caption. */
export function Photos({ legend, items, onChange, max = 16, min = 0, captions = true, hint, itemName = 'Photo' }) {
  return (
    <Repeater
      legend={legend}
      hint={hint}
      items={items}
      onChange={onChange}
      min={min}
      max={max}
      itemName={itemName}
      addLabel="Add a photo"
      make={() => ({ src: '', alt: '' })}
      render={(p, set) => <Photo label={itemName} value={p.src ? p : null} onChange={(v) => set(v ?? { src: '', alt: '' })} caption={captions} />}
    />
  );
}

/** The job's colours, as swatches. */
export function Colours({ value, onChange, max = 8 }) {
  const set = (i, c) => onChange(value.map((x, j) => (j === i ? c : x)));
  return (
    <fieldset className="field">
      <legend>Colours</legend>
      <p className="hint">The brand’s colours, shown as swatches on the case study.</p>
      <ul className="swatches">
        {value.map((c, i) => (
          <li key={i}>
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(c) ? c : '#000000'} onChange={(e) => set(i, e.target.value)} aria-label={`Colour ${i + 1}`} />
            <input className="hex" value={c} onChange={(e) => set(i, e.target.value)} aria-label={`Colour ${i + 1} as a hex code`} maxLength={7} />
            <button
              type="button"
              className="icon-btn small danger"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={`Remove colour ${i + 1}`}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {value.length < max && (
        <button type="button" className="add-btn" onClick={() => onChange([...value, '#111111'])}>
          <Plus aria-hidden="true" />
          Add a colour
        </button>
      )}
    </fieldset>
  );
}

/** Lower-case words joined by hyphens, from any title. */
export const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
