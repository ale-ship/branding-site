import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { STATUS, columnOf } from './format.js';

/** A status as a coloured pill, always with its words. */
export function StatusPill({ status }) {
  const tone = ['cancelled', 'expired'].includes(status) ? 'closed' : (columnOf[status] ?? 'closed');
  return <span className={`pill s-${tone}`}>{STATUS[status] ?? status}</span>;
}

export function PageHead({ crumbs, title, children, actions }) {
  return (
    <div className="page-head">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/**
 * Change against a comparison period, in words as well as an arrow and a tint.
 * @param {{ now: number; before: number; label: string }} p
 */
export function Trend({ now, before, label }) {
  if (!before) return now ? <span className="trend up">New {label}</span> : <span className="trend flat">No change {label}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  const tone = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return (
    <span className={`trend ${tone}`}>
      <Icon aria-hidden="true" />
      {pct > 0 ? '+' : ''}
      {pct}% {label}
    </span>
  );
}

export function Stat({ label, value, icon: Icon, tone, note, href }) {
  const card = (
    <div className="card stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className={`stat-icon${tone === 'red' ? ' red' : ''}`} aria-hidden="true">
            <Icon />
          </span>
        )}
      </div>
      <span className="stat-value">{value}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
  return href ? (
    <a className="stat-link" href={href}>
      {card}
    </a>
  ) : (
    card
  );
}

/** Two letters for an avatar. */
export const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
