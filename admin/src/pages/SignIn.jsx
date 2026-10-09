import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api.js';
import { Contours } from '../contours.jsx';

/**
 * Staff sign-in, straight on the page (owner, 9 Oct 2026: no card, part of the background): Noorcom
 * black with contour lines and two red hills, the logo, the form in light lines with the red button,
 * crop marks around it as on a print proof, and the tagline and CMYK dots at the foot. The same on a
 * phone. There is no "remember me": a session lasts 14 days from the last use anyway. Passwords are
 * reset by an admin (Staff page), so "Forgot password?" says so rather than leading nowhere.
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
      <Contours preset="signin" className="signin-backdrop wide-only" />
      <Contours preset="signinTall" className="signin-backdrop tall-only" />
      <div className="signin-frame">
        {/* Crop marks around the form, as on a print proof. */}
        <span className="crop tl" aria-hidden="true" />
        <span className="crop tr" aria-hidden="true" />
        <span className="crop bl" aria-hidden="true" />
        <span className="crop br" aria-hidden="true" />

        <div className="signin-brand">
          <img src={`${import.meta.env.BASE_URL}nb-mark.png`} alt="" />
          <div>
            <strong>Noorcom Branding</strong>
            <span>Back office</span>
          </div>
        </div>

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
            <p className="signin-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary signin-submit" type="submit" disabled={busy}>
            <LogIn aria-hidden="true" />
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
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
