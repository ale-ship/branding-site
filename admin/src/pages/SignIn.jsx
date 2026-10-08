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
      const { staff } = await api.post('/staff/auth/sign-in', { email: form.get('email'), password: form.get('password') });
      onSignedIn(staff);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="signin">
      <div className="panel">
        <h1>Back office</h1>
        <p className="muted">Noorcom Branding staff only.</p>
        <form onSubmit={submit}>
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
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
