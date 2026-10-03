const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export class ApiClientError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errors = errors;
  }
}

const buildQuery = (params) => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.append(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

// 401 on these paths is a normal answer (wrong password / not signed in), not an expired session
const AUTH_EXEMPT_PATHS = ['/auth/login', '/auth/me', '/auth/logout'];

/**
 * Thin fetch wrapper:
 * - sends the httpOnly auth cookie (credentials: 'include')
 * - parses the standard { success, data, message } envelope
 * - throws ApiClientError with a user-friendly message
 * - broadcasts "auth:expired" when a protected call returns 401 so AuthContext can sign the user out
 */
async function request(path, { method = 'GET', body, params, headers } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery(params)}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiClientError('Cannot reach the server. Check your connection and try again.', 0);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // non-JSON response
  }

  if (!response.ok || (payload && payload.success === false)) {
    if (
      response.status === 401 &&
      typeof window !== 'undefined' &&
      !AUTH_EXEMPT_PATHS.some((p) => path.startsWith(p))
    ) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    throw new ApiClientError(
      payload?.message || 'Request failed. Please try again.',
      response.status,
      payload?.errors || []
    );
  }

  return payload;
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body: body ?? {} }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ?? {} }),
  delete: (path) => request(path, { method: 'DELETE' }),
};