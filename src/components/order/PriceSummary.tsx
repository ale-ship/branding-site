import type { PriceEstimate } from '@/lib/api/order-types';
import { formatDay } from '@/lib/calendar';
import { formatKes } from '@/lib/format';

/**
 * The price breakdown: lines, deadline tier, delivery, total, and what's paid now. Used live in
 * the order form and, frozen at the price agreed, on the order page.
 */
export function PriceSummary({ estimate, heading = 'Your price' }: { estimate: PriceEstimate; heading?: string }) {
  const site = estimate.mechanism === 'B';
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">{heading}</p>
      <dl className="flex flex-col gap-3 text-sm">
        {estimate.lines.map((line, i) => (
          <div key={`${line.label}-${i}`} className="flex items-start justify-between gap-4">
            <dt className="min-w-0">
              <span className="block text-heading">{line.label}</span>
              {line.detail && <span className="block text-muted">{line.detail}</span>}
            </dt>
            <dd className="shrink-0 font-medium text-heading tabular-nums">{formatKes(line.amount)}</dd>
          </div>
        ))}
        {estimate.urgency.amount !== 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-heading">
              {estimate.urgency.label} deadline ({estimate.urgency.multiplier > 1 ? '+' : ''}
              {Math.round((estimate.urgency.multiplier - 1) * 100)}%)
            </dt>
            <dd className="font-medium text-heading tabular-nums">{formatKes(estimate.urgency.amount)}</dd>
          </div>
        )}
        {estimate.handoverFee > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-heading">Delivery</dt>
            <dd className="font-medium text-heading tabular-nums">{formatKes(estimate.handoverFee)}</dd>
          </div>
        )}
      </dl>

      <div className="border-t border-ink pt-4">
        {site ? (
          <p className="text-sm text-body">Firm price after the site survey.</p>
        ) : (
          <p className="flex items-baseline justify-between gap-4">
            <span className="font-semibold text-heading">Total</span>
            <span className="font-display text-2xl font-bold text-heading tabular-nums">{formatKes(estimate.total ?? 0)}</span>
          </p>
        )}
        <p className="mt-3 flex items-baseline justify-between gap-4 bg-paper px-3 py-2.5">
          <span className="text-sm text-heading">
            <span className="block font-semibold">Pay now</span>
            <span className="text-muted">{estimate.dueNow.label}</span>
          </span>
          <span className="font-display text-xl font-bold text-heading tabular-nums">{formatKes(estimate.dueNow.amount)}</span>
        </p>
        {estimate.balanceLater !== null && estimate.balanceLater > 0 && (
          <p className="mt-2 text-sm text-muted">
            The balance of {formatKes(estimate.balanceLater)} is due after you approve the proof, before printing starts.
          </p>
        )}
      </div>

      {estimate.readyBy && (
        <p className="text-sm text-body">
          <span className="font-semibold text-heading">Ready by about {formatDay(estimate.readyBy)}</span>
          <span className="block text-muted">{estimate.leadDays} working days after you approve the proof.</span>
        </p>
      )}
      {estimate.notes.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm text-muted">
          {estimate.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
