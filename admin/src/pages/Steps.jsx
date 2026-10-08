import { useState } from 'react';
import { may } from '../api.js';

/**
 * The next step for this order, for this role (the API checks the same rules): log pieces, mark
 * ready, send out, hand over, cancel, clear a flag. Logging takes seconds: type a number or tap a
 * quick amount.
 */
export function Steps({ order: o, staff, attention, act, upload }) {
  const method = o.handover.method;
  const pieces = o.progress.kind === 'pieces' ? o.progress : null;
  const left = pieces ? pieces.total - pieces.done : 0;
  const cancellable = ['awaiting_payment', 'in_design', 'awaiting_approval', 'awaiting_balance', 'on_hold'].includes(o.status);

  const panels = [];
  if (o.status === 'in_production' && pieces && left > 0 && may(staff, 'progress')) panels.push(<LogPieces key="log" left={left} act={act} />);
  if (o.status === 'in_production' && (!pieces || left === 0) && may(staff, 'ready') && (method === 'pickup' || method === 'delivery')) {
    panels.push(
      <section key="ready" className="panel">
        <h2>Checked and packed?</h2>
        <button className="primary" type="button" onClick={() => act('ready')}>
          Mark ready{method === 'pickup' ? ' for pickup' : ' for delivery'}
        </button>
      </section>,
    );
  }
  if (o.status === 'ready' && method === 'pickup' && may(staff, 'handover')) panels.push(<Pickup key="pickup" act={act} />);
  if (o.status === 'ready' && method === 'delivery' && may(staff, 'dispatch')) panels.push(<Dispatch key="dispatch" act={act} />);
  if (o.status === 'out_for_handover' && method === 'delivery' && may(staff, 'handover')) panels.push(<Delivered key="delivered" act={act} />);
  if (attention && may(staff, 'cancel')) {
    panels.push(
      <section key="attention" className="panel">
        <h2>Flagged</h2>
        <p>Dealt with it (refunded, or agreed with the customer)?</p>
        <button type="button" onClick={() => act('attention/clear')}>
          Clear the flag
        </button>
      </section>,
    );
  }
  if (cancellable && may(staff, 'cancel')) panels.push(<Cancel key="cancel" paid={o.amountPaid} act={act} />);
  if (o.status === 'in_design' && may(staff, 'proofs')) panels.push(<UploadProof key="proof" order={o} upload={upload} />);
  if (o.status === 'awaiting_approval') {
    panels.push(
      <p key="waiting" className="notice">
        Proof v{o.proofs.at(-1)?.version} is with the customer.
      </p>,
    );
  }
  return panels;
}

/** Runs the form's step and clears it when it worked. */
const useSubmit = (run) => {
  const [busy, setBusy] = useState(false);
  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    if (await run(Object.fromEntries(new FormData(form)))) form.reset();
    setBusy(false);
  };
  return [busy, onSubmit];
};

function UploadProof({ order: o, upload }) {
  const [busy, setBusy] = useState(false);
  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    if (await upload(data.get('file'), String(data.get('note') ?? ''))) form.reset();
    setBusy(false);
  };
  const next = o.proofs.length + 1;
  const last = o.proofs.at(-1);
  return (
    <section className="panel" aria-labelledby="upload-title">
      <h2 id="upload-title">Upload proof v{next}</h2>
      {last?.status === 'changes_requested' && <p>The customer asked for changes on v{last.version}: see the proofs below.</p>}
      <p className="muted">PNG or JPEG, up to 10 MB. The customer sees it with PROOF across it.</p>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="proof-file">Proof image</label>
          <input id="proof-file" name="file" type="file" accept="image/png,image/jpeg" required />
        </div>
        <div className="field">
          <label htmlFor="proof-note">Note to the customer (optional)</label>
          <input id="proof-note" name="note" maxLength={300} placeholder={next === 1 ? 'First proof.' : 'Revised as you asked.'} />
        </div>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Uploading…' : 'Send to the customer'}
        </button>
      </form>
    </section>
  );
}

function LogPieces({ left, act }) {
  const [busy, onSubmit] = useSubmit((f) => act('progress', { pieces: Number(f.pieces), note: f.note ?? '' }));
  const quick = [10, 50, 100, left].filter((n, i, all) => n <= left && all.indexOf(n) === i);
  return (
    <section className="panel" aria-labelledby="log-title">
      <h2 id="log-title">Log production</h2>
      <p className="muted">{left} pieces left.</p>
      <div className="quick">
        {quick.map((n) => (
          <button key={n} type="button" disabled={busy} onClick={() => act('progress', { pieces: n, note: '' })}>
            +{n}
            {n === left ? ' (all)' : ''}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="row">
        <div className="field">
          <label htmlFor="pieces">Pieces finished</label>
          <input id="pieces" name="pieces" type="number" inputMode="numeric" min="1" max={left} required />
        </div>
        <div className="field">
          <label htmlFor="note">Note (optional)</label>
          <input id="note" name="note" maxLength={200} placeholder="e.g. front prints" />
        </div>
        <button className="primary" type="submit" disabled={busy}>
          Log
        </button>
      </form>
    </section>
  );
}

function Pickup({ act }) {
  const [busy, onSubmit] = useSubmit((f) => act('handover', { code: f.code, collector: f.collector }));
  return (
    <section className="panel" aria-labelledby="pickup-title">
      <h2 id="pickup-title">Hand over at the counter</h2>
      <form onSubmit={onSubmit} className="row">
        <div className="field">
          <label htmlFor="code">Customer’s pickup code</label>
          <input id="code" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="collector">Collected by</label>
          <input id="collector" name="collector" maxLength={120} required />
        </div>
        <button className="primary" type="submit" disabled={busy}>
          Hand over
        </button>
      </form>
    </section>
  );
}

function Dispatch({ act }) {
  const [busy, onSubmit] = useSubmit((f) => act('dispatch', { rider: f.rider, riderPhone: f.riderPhone, waybill: f.waybill }));
  return (
    <section className="panel" aria-labelledby="dispatch-title">
      <h2 id="dispatch-title">Send it out</h2>
      <p className="muted">A rider’s name and phone, or a courier’s waybill number.</p>
      <form onSubmit={onSubmit} className="row">
        <div className="field">
          <label htmlFor="rider">Rider</label>
          <input id="rider" name="rider" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="riderPhone">Rider’s phone</label>
          <input id="riderPhone" name="riderPhone" type="tel" maxLength={30} />
        </div>
        <div className="field">
          <label htmlFor="waybill">Waybill</label>
          <input id="waybill" name="waybill" maxLength={60} />
        </div>
        <button className="primary" type="submit" disabled={busy}>
          Send out
        </button>
      </form>
    </section>
  );
}

function Delivered({ act }) {
  const [busy, onSubmit] = useSubmit((f) => act('handover', { recipient: f.recipient }));
  return (
    <section className="panel" aria-labelledby="delivered-title">
      <h2 id="delivered-title">Delivered?</h2>
      <form onSubmit={onSubmit} className="row">
        <div className="field">
          <label htmlFor="recipient">Received by</label>
          <input id="recipient" name="recipient" maxLength={120} required />
        </div>
        <button className="primary" type="submit" disabled={busy}>
          Mark delivered
        </button>
      </form>
    </section>
  );
}

function Cancel({ paid, act }) {
  const [busy, onSubmit] = useSubmit((f) => (window.confirm('Cancel this order? The customer is told.') ? act('cancel', { reason: f.reason }) : false));
  return (
    <details className="panel">
      <summary>Cancel this order</summary>
      {paid > 0 && <p className="muted">The customer has paid; the order will be flagged for a refund.</p>}
      <form onSubmit={onSubmit} className="row">
        <div className="field">
          <label htmlFor="reason">Why</label>
          <input id="reason" name="reason" maxLength={300} required />
        </div>
        <button type="submit" disabled={busy}>
          Cancel order
        </button>
      </form>
    </details>
  );
}
