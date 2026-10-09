/**
 * Contour lines, the back office's signature (owner, 9 Oct 2026): hills of closed, slowly wandering
 * lines like a topographic map, drawn as one SVG behind the sign-in page, the sidebar, the page and
 * the dashboard's welcome. Decoration only: hidden from screen readers, never in the way of clicks.
 */

/**
 * One contour line: a circle whose radius wanders with a few slow waves, smoothed into curves.
 * @param {number} cx @param {number} cy @param {number} r @param {number} seed @param {number} [squash]
 */
function ring(cx, cy, r, seed, squash = 0.7) {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const k = 1 + 0.09 * Math.sin(3 * a + seed) + 0.06 * Math.sin(5 * a + seed * 1.7) + 0.04 * Math.sin(2 * a - seed * 0.6);
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * squash]);
  }
  // A smooth closed curve through the points (Catmull-Rom as cubic Béziers).
  const p = (i) => pts[(i + pts.length) % pts.length];
  const f = (n) => n.toFixed(1);
  let d = `M${f(p(0)[0])} ${f(p(0)[1])}`;
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

/**
 * Hills: [centre x, centre y, rings, spacing, seed, red]. Red hills fade outwards from a strong
 * centre; the others are faint.
 * @param {[number, number, number, number, number, boolean][]} hills
 */
const draw = (hills) =>
  hills.flatMap(([cx, cy, n, gap, seed, red]) => Array.from({ length: n }, (_, i) => ({ d: ring(cx, cy, 18 + i * gap, seed + i * 0.35), red, i })));

/** Each place's hills, in a frame the shape of where it is drawn (sliced to fill the box). */
const PRESETS = {
  // The sign-in page on a wide screen: two red hills in opposite corners, faint ones between.
  signin: {
    box: [1440, 900],
    glow: true,
    lines: draw([
      [1260, 120, 11, 34, 1.3, true],
      [170, 820, 10, 36, 4.1, true],
      [720, 470, 14, 46, 2.2, false],
      [1380, 840, 6, 40, 5.4, false],
      [40, 90, 6, 38, 0.4, false],
    ]),
  },
  // The sign-in page on a phone (portrait).
  signinTall: {
    box: [600, 1300],
    glow: true,
    lines: draw([
      [540, 80, 9, 30, 1.3, true],
      [60, 1230, 9, 32, 4.1, true],
      [300, 640, 12, 42, 2.2, false],
    ]),
  },
  // The sidebar (tall and narrow): faint lines, a red hill at the foot.
  side: {
    box: [260, 900],
    lines: draw([
      [210, 860, 9, 24, 3.3, true],
      [30, 140, 8, 28, 5.0, false],
      [240, 430, 9, 30, 1.1, false],
    ]),
  },
  // The page behind everything: very faint lines only.
  page: {
    box: [1440, 900],
    lines: draw([
      [1300, 60, 12, 40, 1.9, false],
      [120, 860, 10, 42, 3.6, false],
    ]),
  },
  // The dashboard's welcome band (wide and short).
  banner: {
    box: [1200, 260],
    glow: true,
    lines: draw([
      [1010, 150, 10, 24, 2.7, true],
      [140, 250, 9, 30, 4.4, false],
      [620, 120, 7, 34, 0.9, false],
    ]),
  },
};

/**
 * @param {{ preset: keyof typeof PRESETS; className?: string; ink?: string; faint?: number; red?: string }} p
 *   `ink` and `faint` set the colour and strength of the plain lines (white on dark, grey on light).
 */
export function Contours({ preset, className = '', ink = '#ffffff', faint = 0.07, red = '#d7000f' }) {
  const { lines, glow, box } = PRESETS[preset];
  const id = `glow-${preset}`;
  return (
    <svg className={`contours ${className}`} viewBox={`0 0 ${box[0]} ${box[1]}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {glow && (
        <>
          <defs>
            <radialGradient id={id} cx="80%" cy="10%" r="65%">
              <stop offset="0" stopColor={red} stopOpacity="0.32" />
              <stop offset="1" stopColor={red} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={box[0]} height={box[1]} fill={`url(#${id})`} />
        </>
      )}
      <g fill="none">
        {lines.map(({ d, red: isRed, i }, n) => (
          <path
            key={n}
            d={d}
            stroke={isRed ? red : ink}
            strokeOpacity={isRed ? Math.max(0.12, 0.75 - i * 0.06) : faint}
            strokeWidth={isRed && i < 3 ? 1.6 : 1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  );
}
