import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api.js';

export function SignIn({ onSignedIn }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    <main className="signin-page" style={{ padding: 0, maxWidth: 'none' }}>
      <div className="signin-art" aria-hidden="true">
        <div className="side-brand" style={{ border: 0, padding: 0 }}>
          <img src={`${import.meta.env.BASE_URL}nb-mark.png`} alt="" />
          <div>
            <strong>Noorcom Branding</strong>
            <span>Back office</span>
          </div>
        </div>
        <div>
          <h2>Every order, from brief to handover.</h2>
          <p>Proofs, production, payments and pickups in one place, from the desk or the workshop floor.</p>
        </div>
      </div>
      <div className="signin-form">
        <form onSubmit={submit}>
          <div className="side-brand">
            <img src={`${import.meta.env.BASE_URL}nb-mark.png`} alt="" style={{ border: '1px solid var(--line)' }} />
            <div>
              <strong>Noorcom Branding</strong>
              <span>Back office</span>
            </div>
          </div>
          <h1>Sign in</h1>
          <p className="muted" style={{ marginBottom: '1.25rem' }}>
            For Noorcom Branding staff only.
          </p>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" type="submit" disabled={busy} style={{ width: '100%' }}>
            <LogIn aria-hidden="true" />
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
