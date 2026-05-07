export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('sessionToken') : null;
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (token && !headers.get('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { ...init, headers } as RequestInit);

  // Session expirée ou invalide → rediriger vers login
  if (response.status === 401) {
    const cloned = response.clone();
    try {
      const body = await cloned.json();
      if (body.error === 'session_expired' || body.error === 'session invalide') {
        localStorage.removeItem('sessionToken');
        // Éviter une boucle infinie si on est déjà sur la page de login
        if (!window.location.pathname.includes('connection') && !window.location.pathname.includes('login')) {
          window.location.href = '/admin/sama_page_de_connection?reason=session_expired';
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return response;
}

export default apiFetch;
