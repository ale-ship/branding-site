import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { ROLE } from '../format.js';

/** Admins add staff, change their role, deactivate them, or set a new password. */
export function StaffPage({ me, onAuthLost }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)), [onAuthLost]);
  const load = useCallback(() => api.get('/staff/users').then((r) => setUsers(r.users)).catch(fail), [fail]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, done) => {
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(done);
      load();
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    if (await run(() => api.post('/staff/users', f), `${f.name} can sign in now.`)) form.reset();
  };
  const change = (u, body, done) => run(() => api.patch(`/staff/users/${u.id}`, body), done);
  const resetPassword = (u) => {
    const password = window.prompt(`New password for ${u.name} (12+ characters). They will be signed out everywhere.`);
    if (password) change(u, { password }, `${u.name}’s password is changed.`);
  };

  return (
    <>
      <h1>Staff</h1>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Account</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <label className="sr-only" htmlFor={`role-${u.id}`}>
                    Role for {u.name}
                  </label>
                  <select id={`role-${u.id}`} value={u.role} onChange={(e) => change(u, { role: e.target.value }, `${u.name} is now ${ROLE[e.target.value]}.`)}>
                    {Object.entries(ROLE).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="quick">
                    {u.id !== me.id && (
                      <button type="button" onClick={() => change(u, { active: !u.active }, `${u.name} is ${u.active ? 'deactivated' : 'active again'}.`)}>
                        {u.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                    <button type="button" onClick={() => resetPassword(u)}>
                      New password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="panel" aria-labelledby="add-title" style={{ marginTop: '1rem' }}>
        <h2 id="add-title">Add a staff member</h2>
        <form onSubmit={add}>
          <div className="row">
            <div className="field">
              <label htmlFor="new-name">Name</label>
              <input id="new-name" name="name" required maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="new-email">Email</label>
              <input id="new-email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="new-role">Role</label>
              <select id="new-role" name="role" defaultValue="sales">
                {Object.entries(ROLE).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="new-password">First password (12+ characters)</label>
              <input id="new-password" name="password" type="password" minLength={12} required autoComplete="new-password" />
            </div>
          </div>
          <button className="primary" type="submit" style={{ marginTop: '0.75rem' }}>
            Add
          </button>
        </form>
      </section>
    </>
  );
}
