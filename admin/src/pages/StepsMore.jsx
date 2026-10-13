import { useState } from 'react';
import { day, kes } from '../format.js';

/**
 * The steps after B4 (B5), next to the ones in Steps.jsx: the pre-production sample's photo, an early
 * delivery, a site job's firm quote and stages, and a design-only order's final files. The API
 * checks the same rules; these only show what can be done now.
 */

const MATERIALS = [
  ['vinyl', 'Printed vinyl'],
  ['wallpaper', 'Printed wallpaper'],
  ['frosted', 'Frosted glass film'],
  ['acp-sign', 'ACP sign with 3D letters'],
  ['lightbox', 'Light box'],
  ['flex-banner', 'Flex banner on frame'],
  ['vehicle-wrap', 'Cast vehicle wrap vinyl'],
];

const size = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** @returns {JSX.Element[]} */
export function moreSteps({ order: o, act, sendFile, remove }) {
  const panels = [];
  const s = o.sample;
  if (o.status === 'in_production' && s && (s.status === 'waiting' || s.status === 'changes_requested')) panels.push(<SamplePanel key="sample" sample={s} sendFile={sendFile} />);
  if (o.status === 'in_production' && s?.status === 'pending') {
    panels.push(
      <p key="sample-wait" className="notice">
        The sample is with the customer. The full run starts when they approve it.
      </p>,
    );
  }
  const early = o.deliveries.find((d) => d.partial && d.status !== 'delivered');
  if (early) panels.push(<EarlyDelivery key="early" delivery={early} act={act} />);

  if (o.mechanism === 'B') {
    if (o.status === 'in_design' && !o.survey?.booked) {
      panels.push(
        <p key="survey-wait" className="notice">
          Waiting for the customer to book the survey{o.survey?.preferred?.length ? ` (they suggested ${o.survey.preferred.map(day).join(' or ')})` : ''}.
        </p>,
      );
    }
    if (o.status === 'in_design' && o.survey?.booked && o.siteQuote?.status !== 'accepted') panels.push(<QuoteBuilder key="quote" order={o} act={act} />);
    if (o.status === 'in_production') panels.push(<StagePanel key="stage" order={o} act={act} />);
  }
  if (o.mechanism === 'C' && o.status === 'out_for_handover') panels.push(<FinalFiles key="finals" order={o} act={act} sendFile={sendFile} remove={remove} />);
  return panels;
}

function SamplePanel({ sample, sendFile }) {
  const [busy, setBusy] = useState(false);
  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const file = new FormData(form).get('file');
    setBusy(true);
    if (await sendFile('sample', file)) form.reset();
    setBusy(false);
  };
  return (
    <section className="panel" aria-labelledby="sample-title">
      <h2 id="sample-title">Pre-production sample</h2>
      {sample.status === 'changes_requested' ? (
        <p>
          The customer asked for changes: <q>{sample.comments}</q> Print a new sample and send its photo.
        </p>
      ) : (
        <p className="muted">Print one piece, photograph it in good light and send the photo. Logging the full run waits for the customer’s approval.</p>
      )}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="sample-file">Photo of the sample (PNG or JPEG)</label>
          <input id="sample-file" name="file" type="file" accept="image/png,image/jpeg" required />
        </div>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send to the customer'}
        </button>
      </form>
    </section>
  );
}

function EarlyDelivery({ delivery: d, act }) {
  const [busy, setBusy] = useState(false);
  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    if (await act('early-delivery', Object.fromEntries(new FormData(form)))) form.reset();
    setBusy(false);
  };
  return (
    <section className="panel" aria-labelledby="early-title">
      <h2 id="early-title">Early delivery: {d.pieces.toLocaleString('en-KE')} pieces</h2>
      <form onSubmit={onSubmit} className="row">
        {d.status === 'requested' ? (
          <>
            <div className="field">
              <label htmlFor="early-rider">Rider</label>
              <input id="early-rider" name="rider" maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="early-phone">Rider’s phone</label>
              <input id="early-phone" name="riderPhone" type="tel" maxLength={30} />
            </div>
            <div className="field">
              <label htmlFor="early-waybill">Or a waybill</label>
              <input id="early-waybill" name="waybill" maxLength={60} />
            </div>
          </>
        ) : (
          <div className="field">
            <label htmlFor="early-recipient">Received by</label>
            <input id="early-recipient" name="recipient" maxLength={120} required />
          </div>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {d.status === 'requested' ? 'Send out' : 'Mark delivered'}
        </button>
      </form>
    </section>
  );
}

const blankItem = () => ({ label: '', material: 'vinyl', widthCm: '', heightCm: '', quantity: '1' });

/** The quote builder (spec, "Quote builder (Mechanism B)"): measured items, extras, notes. */
function QuoteBuilder({ order: o, act }) {
  const q = o.siteQuote;
  const [items, setItems] = useState(q ? q.items.map((i) => ({ ...i, widthCm: String(i.widthCm), heightCm: String(i.heightCm), quantity: String(i.quantity) })) : [blankItem()]);
  const [extras, setExtras] = useState(q ? q.lines.filter((l) => !q.items.some((i) => i.label === l.label) && l.label !== 'Installation').map((l) => ({ label: l.label, detail: l.detail ?? '', amount: String(l.amount) })) : []);
  const [notes, setNotes] = useState(q?.surveyNotes ?? '');
  const [busy, setBusy] = useState(false);
  const setItem = (i, k, v) => setItems((all) => all.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setExtra = (i, k, v) => setExtras((all) => all.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await act('site-quote', {
      items: items.map((i) => ({ label: i.label, material: i.material, widthCm: Number(i.widthCm), heightCm: Number(i.heightCm), quantity: Number(i.quantity) })),
      extras: extras.filter((x) => x.label.trim()).map((x) => ({ label: x.label, detail: x.detail, amount: Number(x.amount) })),
      notes,
    });
    setBusy(false);
  };
  return (
    <section className="panel" aria-labelledby="quote-title">
      <h2 id="quote-title">{q ? 'Firm quote sent' : 'After the survey: the firm quote'}</h2>
      <p className="muted">
        Survey {day(o.survey.booked)}. {q ? `${kes(q.total)}, valid until ${day(q.validUntil)}; the customer hasn’t accepted it yet. Change it below and send again if needed.` : 'Enter what you measured; the price, fitting and deposit are worked out for you.'}
      </p>
      <form onSubmit={onSubmit}>
        {items.map((it, i) => (
          <fieldset key={i} className="repeat-item">
            <legend className="repeat-head">Item {i + 1}</legend>
            <div className="row">
              <div className="field">
                <label htmlFor={`qi-label-${i}`}>What</label>
                <input id={`qi-label-${i}`} value={it.label} onChange={(e) => setItem(i, 'label', e.target.value)} placeholder="Reception wall" required maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor={`qi-material-${i}`}>Material</label>
                <select id={`qi-material-${i}`} value={it.material} onChange={(e) => setItem(i, 'material', e.target.value)}>
                  {MATERIALS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor={`qi-w-${i}`}>Width (cm)</label>
                <input id={`qi-w-${i}`} type="number" inputMode="decimal" min="1" value={it.widthCm} onChange={(e) => setItem(i, 'widthCm', e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor={`qi-h-${i}`}>Height (cm)</label>
                <input id={`qi-h-${i}`} type="number" inputMode="decimal" min="1" value={it.heightCm} onChange={(e) => setItem(i, 'heightCm', e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor={`qi-q-${i}`}>How many</label>
                <input id={`qi-q-${i}`} type="number" inputMode="numeric" min="1" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} required />
              </div>
            </div>
            {items.length > 1 && (
              <button type="button" className="small-btn" onClick={() => setItems((all) => all.filter((_, j) => j !== i))}>
                Remove item {i + 1}
              </button>
            )}
          </fieldset>
        ))}
        <button type="button" className="add-btn" onClick={() => setItems((all) => [...all, blankItem()])}>
          Add an item
        </button>
        {extras.map((x, i) => (
          <div key={i} className="row">
            <div className="field">
              <label htmlFor={`qx-label-${i}`}>Extra</label>
              <input id={`qx-label-${i}`} value={x.label} onChange={(e) => setExtra(i, 'label', e.target.value)} placeholder="County permit" maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor={`qx-amount-${i}`}>Amount (KES)</label>
              <input id={`qx-amount-${i}`} type="number" inputMode="numeric" min="0" value={x.amount} onChange={(e) => setExtra(i, 'amount', e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={() => setExtras((all) => [...all, { label: '', detail: '', amount: '' }])}>
          Add an extra (permit, night work…)
        </button>
        <div className="field">
          <label htmlFor="q-notes">Survey notes for the customer</label>
          <textarea id="q-notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Walls are smooth plaster…" />
        </div>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Sending…' : q ? 'Send the new quote' : 'Send the quote to the customer'}
        </button>
      </form>
    </section>
  );
}

function StagePanel({ order: o, act }) {
  const next = o.progress.stages?.find((s) => !s.done);
  if (!next) return null;
  const waiting = next.name === 'Installation scheduled' && !o.installDate;
  return (
    <section className="panel" aria-labelledby="stage-title">
      <h2 id="stage-title">Next stage: {next.name}</h2>
      {o.installDate && <p>Installation booked for {day(o.installDate)}.</p>}
      {waiting ? (
        <p className="notice">Waiting for the customer to choose an installation date on their order page.</p>
      ) : (
        <button className="primary" type="button" onClick={() => act('stage')}>
          {next.name === 'Signed off' ? 'Signed off on site' : `Mark “${next.name}” done`}
        </button>
      )}
      {next.name === 'Signed off' && <p className="muted small">The balance then falls due; the survey fee is already off it.</p>}
    </section>
  );
}

function FinalFiles({ order: o, act, sendFile, remove }) {
  const [busy, setBusy] = useState(false);
  const files = o.finalFiles ?? [];
  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const chosen = [...form.elements.namedItem('files').files];
    setBusy(true);
    for (const file of chosen) if (!(await sendFile('finals', file, { 'x-file-name': encodeURIComponent(file.name) }))) break;
    form.reset();
    setBusy(false);
  };
  return (
    <section className="panel" aria-labelledby="finals-title">
      <h2 id="finals-title">Final files</h2>
      <p className="muted">The design is approved. Upload the files the customer gets (PDF, PNG, AI, ZIP…, up to 50 MB each), then send them: the order completes.</p>
      {files.length > 0 && (
        <ul className="content-list">
          {files.map((f) => (
            <li key={f.id} className="row">
              <a href={f.url}>{f.name}</a> <span className="muted">{size(f.size)}</span>
              <button type="button" className="small-btn" onClick={() => remove(`finals/${f.id}`)}>
                Remove<span className="sr-only"> {f.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="final-files">Add files</label>
          <input id="final-files" name="files" type="file" multiple required />
        </div>
        <button type="submit" disabled={busy}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      <button className="primary" type="button" disabled={!files.length} onClick={() => act('finals/send')}>
        Send {files.length || ''} {files.length === 1 ? 'file' : 'files'} to the customer
      </button>
    </section>
  );
}
