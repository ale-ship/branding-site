import { useMemo, useRef, useState } from 'react';
import { kes } from '../format.js';

const W = 720;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 26, left: 56 };

/** A rounded axis maximum and its four gridlines. */
function niceMax(v) {
  if (v <= 0) return 1000;
  const step = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / step) * step;
}
const short = (n) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const label = (ymd, o) => new Date(`${ymd}T12:00:00+03:00`).toLocaleDateString('en-KE', o);

/**
 * Money received per day: one series, a 2px line over a faint fill, recessive gridlines, a crosshair
 * and tooltip on hover or focus (the dataviz method). A table of the same numbers is there for screen
 * readers and anyone who wants the figures.
 */
export function RevenueChart({ data }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const { points, max, x, y } = useMemo(() => {
    const max = niceMax(Math.max(...data.map((d) => d.amount)));
    const x = (i) => PAD.left + (i / Math.max(1, data.length - 1)) * (W - PAD.left - PAD.right);
    const y = (v) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
    return { points: data.map((d, i) => [x(i), y(d.amount)]), max, x, y };
  }, [data]);

  const line = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');
  const area = `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  const pick = (clientX) => {
    const r = box.current.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((sx - PAD.left) / (W - PAD.left - PAD.right)) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="chart-wrap">
      <svg
        ref={box}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Money received per day over the last 30 days, up to ${kes(Math.max(...data.map((d) => d.amount)))} in a day`}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setHover((i) => Math.min(data.length - 1, (i ?? -1) + 1));
          if (e.key === 'ArrowLeft') setHover((i) => Math.max(0, (i ?? data.length) - 1));
          if (e.key === 'Escape') setHover(null);
        }}
        onBlur={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
              {short(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % 5 === 0 || i === data.length - 1 ? (
            <text key={d.day} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
              {label(d.day, { day: 'numeric', month: 'short' })}
            </text>
          ) : null,
        )}
        <path className="series-area" d={area} />
        <path className="series-line" d={line} />
        {h && (
          <g>
            <line className="crosshair" x1={points[hover][0]} x2={points[hover][0]} y1={PAD.top} y2={y(0)} />
            <circle className="dot" cx={points[hover][0]} cy={points[hover][1]} r="5" />
          </g>
        )}
      </svg>
      {h && (
        <div
          className="tooltip"
          style={{
            left: `${(points[hover][0] / W) * 100}%`,
            top: `${(points[hover][1] / H) * 100}%`,
          }}
          aria-live="polite"
        >
          <span>{label(h.day, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          {kes(h.amount)} · {h.payments} {h.payments === 1 ? 'payment' : 'payments'}
        </div>
      )}
      <table className="sr-only">
        <caption>Money received per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Received</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{kes(d.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
