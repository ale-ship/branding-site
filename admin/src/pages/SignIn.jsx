import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api.js';

/**
 * Staff sign-in: one card, a red header with contour lines and the logo that curves into the form
 * (owner's reference, 9 Oct 2026). Full screen on a phone, a centred card on a wide screen. There is
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
    </main>
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
