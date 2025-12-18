import { useEffect, useState } from "react";
import { apiFetch } from '@/lib/api';
import { useNavigate } from "react-router-dom";

export const useAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdmin();
    // also listen to storage changes (other tabs)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'sessionToken') checkAdmin();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const checkAdmin = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sessionToken');
      if (!token) {
        setIsAdmin(false);
        setUser(null);
        navigate('/ne_ka_connection_page');
        return;
      }

      const resp = await apiFetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) {
        setIsAdmin(false);
        setUser(null);
        navigate('/ne_ka_connection_page');
        return;
      }

      const payload = await resp.json();
      const u = payload.user;
      setUser(u);
      const roles = u?.roles || [];
      if (roles.includes('admin')) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        navigate('/');
      }
    } catch (err) {
      console.error('Error checking admin status:', err);
      setIsAdmin(false);
      setUser(null);
      navigate('/ne_ka_connection_page');
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, loading, user };
};