export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiFetch(path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, init);
}

export default apiFetch;
