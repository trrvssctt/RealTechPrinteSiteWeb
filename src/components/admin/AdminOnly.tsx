import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';

const AdminOnly = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
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
        const u = payload.user;
        const rawRoles = u?.roles || [];
        const roles: string[] = Array.isArray(rawRoles) ? rawRoles.map((r:any) => (r||'').toString().toLowerCase()) : [];
        if (mounted) setIsAdmin(roles.includes('admin'));
      } catch (err) {
        console.error('AdminOnly check failed', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    check();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default AdminOnly;
