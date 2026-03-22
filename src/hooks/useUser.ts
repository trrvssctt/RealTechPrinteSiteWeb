import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export const useUser = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchMe = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        if (!token) {
          if (mounted) setLoading(false);
          return;
        }
        const resp = await apiFetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) {
          if (mounted) setLoading(false);
          return;
        }
        const payload = await resp.json().catch(() => ({}));
        if (!mounted) return;
        setUser(payload.user || null);
      } catch (err) {
        console.error('useUser error', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMe();
    return () => { mounted = false; };
  }, []);

  return { user, loading };
};

export default useUser;
