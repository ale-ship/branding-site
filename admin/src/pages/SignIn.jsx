import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api.js';

/**
 * Staff sign-in: one card, a red header with contour lines and the logo that curves into the form
 * (owner's reference, 9 Oct 2026), on a black page of contour lines with two red hills, crop marks at
 * the card's corners and CMYK dots by the footer. Full screen on a phone, where the card is the page. There is
 * no "remember me": a session lasts 14 days from the last use anyway. Passwords are reset by an
 * admin (Staff page), so "Forgot password?" says so rather than leading nowhere.
 */
export function SignIn({ onSignedIn }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const { staff } = await api.post('/staff/auth/sign-in', {
        email: form.get('email'),
        password: form.get('password'),
      });
      onSignedIn(staff);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="signin-page">
      <Backdrop />
      <div className="signin-frame">
        {/* Crop marks at the card's corners, as on a print proof. */}
        <span className="crop tl" aria-hidden="true" />
        <span className="crop tr" aria-hidden="true" />
        <span className="crop bl" aria-hidden="true" />
        <span className="crop br" aria-hidden="true" />
        <div className="signin-card">
          <header className="signin-head">
            <Contours />
            <div className="signin-brand">
              <img src={`${import.meta.env.BASE_URL}nb-mark.png`} alt="" />
              <div>
                <strong>Noorcom Branding</strong>
                <span>Back office</span>
              </div>
            </div>
            <svg className="signin-wave" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d="M0 34 C 70 0, 150 10, 215 30 S 340 62, 400 22 L 400 60 L 0 60 Z" />
            </svg>
          </header>

          <form className="signin-body" onSubmit={submit}>
            <h1>Sign in</h1>
            <p className="signin-lead">For Noorcom Branding staff.</p>

            <div className="line-field">
              <label htmlFor="email">Email</label>
              <div className="line-input">
                <Mail aria-hidden="true" />
                <input id="email" name="email" type="email" autoComplete="username" placeholder="you@noorcombranding.co.ke" required />
              </div>
            </div>

            <div className="line-field">
              <label htmlFor="password">Password</label>
              <div className="line-input">
                <Lock aria-hidden="true" />
                <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required />
                <button
                  type="button"
                  className="eye"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  aria-pressed={show}
                >
                  {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="signin-row">
              <button type="button" className="text-link" onClick={() => setHelp((h) => !h)} aria-expanded={help} aria-controls="forgot-help">
                Forgot password?
              </button>
            </div>
            <p id="forgot-help" className="signin-help" hidden={!help}>
              Ask the admin to set a new one for you (Staff, in the back office). You’ll be signed out everywhere else when they do.
            </p>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary signin-submit" type="submit" disabled={busy}>
              <LogIn aria-hidden="true" />
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
      <footer className="signin-foot">
        <p className="signin-tagline">Every order, from brief to handover.</p>
        <p className="signin-small">
          <span className="cmyk" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          Design | Print | Brand · Loita Street, Nairobi
        </p>
      </footer>
    </main>
  );
}

/**
 * A closed contour line: a circle whose radius wanders with a few slow waves, like a hill on a map.
 * @param {number} cx @param {number} cy @param {number} r @param {number} seed @param {number} squash
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
  let d = `M${p(0)[0].toFixed(1)} ${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

/** Hills of contour lines: [centre x, centre y, rings, spacing, seed, red]. */
const HILLS = [
  [1260, 120, 11, 34, 1.3, true],
  [170, 820, 10, 36, 4.1, true],
  [720, 470, 14, 46, 2.2, false],
  [1380, 840, 6, 40, 5.4, false],
  [40, 90, 6, 38, 0.4, false],
];
const BACKDROP = HILLS.flatMap(([cx, cy, n, gap, seed, red]) =>
  Array.from({ length: n }, (_, i) => ({ d: ring(cx, cy, 18 + i * gap, seed + i * 0.35), red, i })),
);

/** The page behind the card: Noorcom black with contour lines, two of the hills in red. */
function Backdrop() {
  return (
    <svg className="signin-backdrop" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="glow" cx="78%" cy="8%" r="60%">
          <stop offset="0" stopColor="#d7000f" stopOpacity="0.32" />
          <stop offset="1" stopColor="#d7000f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#glow)" />
      <g fill="none">
        {BACKDROP.map(({ d, red, i }, n) => (
          <path key={n} d={d} stroke={red ? '#d7000f' : '#ffffff'} strokeOpacity={red ? 0.75 - i * 0.05 : 0.07} strokeWidth={red && i < 3 ? 1.6 : 1} />
        ))}
      </g>
    </svg>
  );
}

/** Topographic contour lines across the header, as on the reference: decoration only. */
function Contours() {
  return (
    <svg className="signin-contours" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g fill="none" strokeWidth="1.2">
        <path d="M-20 40 C 40 10, 90 70, 150 45 S 260 -5, 330 30 S 420 60, 440 40" />
        <path d="M-20 62 C 45 32, 95 92, 155 67 S 262 17, 332 52 S 420 82, 440 62" />
        <path d="M-20 84 C 50 54, 100 114, 160 89 S 264 39, 334 74 S 420 104, 440 84" />
        <path d="M-20 160 C 30 130, 80 190, 140 170 S 250 120, 320 150 S 410 180, 440 160" />
        <path d="M-20 184 C 35 154, 85 214, 145 194 S 255 144, 325 174 S 410 204, 440 184" />
        <path d="M-20 208 C 40 178, 90 238, 150 218 S 260 168, 330 198 S 410 228, 440 208" />
        <ellipse cx="300" cy="118" rx="58" ry="26" />
        <ellipse cx="300" cy="118" rx="38" ry="15" />
        <ellipse cx="300" cy="118" rx="18" ry="6" />
        <ellipse cx="70" cy="128" rx="44" ry="18" transform="rotate(-12 70 128)" />
        <ellipse cx="70" cy="128" rx="24" ry="8" transform="rotate(-12 70 128)" />
      </g>
    </svg>
  );
}
