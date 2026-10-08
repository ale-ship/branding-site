/**
 * The back office talks only to /api/staff (and sign-in). The session is the httpOnly `nb_staff`
 * cookie; changes carry `X-Requested-With: nb-admin`, which the API requires (CSRF).
 */

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      ...(method !== 'GET' ? { 'x-requested-with': 'nb-admin' } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? `Something went wrong (${res.status}).`);
  return data;
}

export const api = {
  get: (path) => call('GET', path),
  post: (path, body = {}) => call('POST', path, body),
  patch: (path, body) => call('PATCH', path, body),
};

/** The roles that may take each step (the API checks the same). Admin may do everything. */
export const MAY = {
  progress: ['production'],
  ready: ['production', 'sales'],
  dispatch: ['sales', 'installer'],
  handover: ['sales', 'installer'],
  cancel: ['sales'],
  payments: ['sales'],
  staff: [],
};

export const may = (staff, step) => staff?.role === 'admin' || MAY[step].includes(staff?.role);
