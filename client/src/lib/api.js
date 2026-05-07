export async function apiFetch(path, init = {}) {
  const normalizedPath = path.startsWith('/api') ? path : `/api${path}`;
  return fetch(normalizedPath, init);
}

export async function authApiFetch(path, token, init = {}) {
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return apiFetch(path, {
    ...init,
    headers,
  });
}
