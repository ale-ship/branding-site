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
  /** Sends a file as the raw body (proofs: PNG or JPEG). */
  async upload(path, file, headers = {}) {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'x-requested-with': 'nb-admin', 'content-type': file.type || 'application/octet-stream', ...headers },
      body: file,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? `Upload failed (${res.status}).`);
    return data;
  },
};

/**
 * The roles that may take each step (the API checks the same). Admin may do everything; the
 * designers run every order from design to handover; the money side is the admin's alone.
 */
export const MAY = {
  proofs: ['designer'],
  progress: ['designer'],
  ready: ['designer'],
  dispatch: ['designer'],
  handover: ['designer'],
  cancel: ['designer'],
  payments: ['designer'],
  finance: [],
  staff: [],
};

/** A link to download a report or statement (GET, with the session cookie). */
export const fileUrl = (path, params) => `/api${path}?${new URLSearchParams(params)}`;

export const may = (staff, step) => staff?.role === 'admin' || MAY[step].includes(staff?.role);
