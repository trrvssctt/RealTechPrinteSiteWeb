export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiFetch(path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('sessionToken') : null;
  const headers = new Headers(init && init.headers ? init.headers as HeadersInit : undefined);
  if (token && !headers.get('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const finalInit = { ...(init || {}), headers };
  return fetch(url, finalInit as RequestInit);
}

export default apiFetch;
