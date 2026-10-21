import { useState } from 'react';
import { kes, when } from '../format.js';

/**
 * Payments by hand (owner, 21 Oct 2026): until the M-Pesa prompt is connected, customers pay to the
 * Paybill on their invoice (or by bank or cash) and a designer records it here, signed in as
 * themselves. Recording moves the order on exactly as a confirmed M-Pesa payment would: receipt
 * number, status, the customer's email. If the customer sent their M-Pesa code, it's filled in.
 */

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
const PURPOSE = { deposit: 'deposit', full: 'full payment', survey_fee: 'survey fee', balance: 'balance' };

export function RecordPayment({ order: o, attention, act }) {
  const report = o.paymentReport;
  const [channel, setChannel] = useState('mpesa');
  const [busy, setBusy] = useState(false);
  const due = o.dueNow > 0;

  const onSubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const amount = Number(String(f.amount).replace(/[\s,]/g, ''));
    const what = `${kes(amount)} by ${channel === 'mpesa' ? 'M-Pesa' : channel === 'bank' ? 'bank transfer' : 'cash'}${f.reference ? `, ${String(f.reference).toUpperCase()}` : ''}`;
    if (!window.confirm(`Record ${what} on ${o.ref}? The customer gets their receipt and the order moves on.`)) return;
    setBusy(true);
    await act('payments', { amount, channel, reference: String(f.reference ?? ''), paidOn: String(f.paidOn) });
    setBusy(false);
  };

  const form = (
    <form onSubmit={onSubmit} key={report?.code ?? 'none'}>
      <div className="row">
        <div className="field">
          <label htmlFor="pay-amount">Amount (KES)</label>
          <input id="pay-amount" name="amount" inputMode="numeric" required defaultValue={report?.amount ?? (due ? o.dueNow : '')} />
        </div>
        <div className="field">
          <label htmlFor="pay-channel">Paid by</label>
          <select id="pay-channel" name="channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="mpesa">M-Pesa (Paybill)</option>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash</option>
          </select>
        </div>
      </div>
      <div className="row" style={{ marginTop: '0.85rem' }}>
        {channel !== 'cash' && (
          <div className="field">
            <label htmlFor="pay-ref">{channel === 'mpesa' ? 'M-Pesa code' : 'Bank reference'}</label>
            <input id="pay-ref" name="reference" required autoComplete="off" defaultValue={channel === 'mpesa' ? (report?.code ?? '') : ''} placeholder={channel === 'mpesa' ? 'TJK4XY12AB' : ''} />
          </div>
        )}
        <div className="field">
          <label htmlFor="pay-date">Date paid</label>
          <input id="pay-date" name="paidOn" type="date" required max={today()} defaultValue={today()} />
        </div>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Recording…' : 'Record payment'}
        </button>
      </div>
    </form>
  );

  return (
    <section className="panel" aria-labelledby="record-title">
      <h2 id="record-title">{due ? `Record the ${PURPOSE[o.duePurpose] ?? 'payment'}: ${kes(o.dueNow)}` : 'Record a payment'}</h2>
      {report && (
        <div className="notice">
          <p style={{ margin: 0 }}>
            <strong>{o.customer.name}</strong> says they paid{report.amount ? ` ${kes(report.amount)}` : ''}, M-Pesa code <strong>{report.code}</strong> ({when(report.at)}).
            Check it on the Paybill statement, then record it below.
          </p>
          {attention === 'payment-reported' && (
            <button type="button" style={{ marginTop: '0.6rem' }} onClick={() => window.confirm(`Tell ${o.customer.name} we couldn’t find ${report.code}?`) && act('attention/clear')}>
              Couldn’t find it: ask the customer to check
            </button>
          )}
        </div>
      )}
      {due ? (
        <>
          <p className="muted">Customers pay to Paybill 303030, account number with {o.ref.replace('-', '')}. Record it once you see the money.</p>
          {form}
        </>
      ) : (
        <details>
          <summary>Nothing is due. Record money that came in anyway</summary>
          <p className="muted">It counts towards the order; anything beyond the total is kept as credit.</p>
          {form}
        </details>
      )}
    </section>
  );
}
