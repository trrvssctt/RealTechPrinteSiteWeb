import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  Package, 
  FolderTree, 
  ShoppingCart, 
  MessageSquare, 
  Phone,
  Users,
  LogOut,
  Loader2,
  Home,
  Bell,
  Settings,
  ChartAreaIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import logo_realtech from '../../../assets/logo_realtech.png';


const AdminLayout = ({ children }: { children?: any }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

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
        const u = payload.user;
        setUser(u);
        const rawRoles = u?.roles || [];
        const roles: string[] = Array.isArray(rawRoles) ? rawRoles.map((r:any) => (r||'').toString().toLowerCase()) : [];
        setIsAdmin(roles.includes('admin'));
        setIsEmployee(roles.includes('employee') || roles.includes('employe') || roles.includes('employé') || roles.includes('staff'));
      } catch (err) {
        console.error('fetchMe error', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMe();
    return () => { mounted = false; };
  }, []);
  const location = useLocation();

  const handleLogout = async () => {
    try {
      localStorage.removeItem('sessionToken');
      toast.success("Déconnexion réussie");
      window.location.href = '/admin/sama_page_de_connection';
    } catch (err) {
      console.error('Logout error', err);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // allow admins and employees to view the admin layout (employees have restricted actions elsewhere)
  if (!isAdmin && !isEmployee) {
    // if not authorized, redirect to login
    window.location.href = '/admin/sama_page_de_connection';
    return null;
  }

  const navItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Tableau de bord", badge: null },
    { path: "/admin/products", icon: Package, label: "Produits", badge: null },
    { path: "/admin/services", icon: Package, label: "Services", badge: null },
    { path: "/admin/stock", icon: Package, label: "Stock", badge: null },
    { path: "/admin/users", icon: Users, label: "Utilisateurs", badge: null },
    { path: "/admin/clients", icon: Users, label: "Clients", badge: null },
    { path: "/admin/categories", icon: FolderTree, label: "Catégories", badge: null },
    { path: "/admin/orders", icon: ShoppingCart, label: "Commandes", badge: "pending" },
    { path: "/admin/carts", icon: ShoppingCart, label: "Paniers", badge: null },
    { path: "/admin/messages", icon: MessageSquare, label: "Messages", badge: "unread" },
    //{ path: "/admin/testimonials", icon: MessageSquare, label: "Témoignages", badge: null },
    { path: "/admin/rapports", icon: ChartAreaIcon, label: "Rapports", badge: null },
    //{ path: "/admin/contact", icon: Phone, label: "Contacts", badge: null },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (isEmployee) {
      // hide Users and Messages pages for employees
      if (item.path === '/admin/users' || item.path === '/admin/messages') return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex h-16 items-center px-6">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <Link to="/admin" className="flex items-center gap-3">
              <div className="w-25 h-15-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-sm">
          <img 
            src={logo_realtech} 
            alt="RealTech Holding" 
            className="w-25 h-17 "
          />
        </div>
            
            </Link>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User & Notifications */}
          <div className="flex items-center gap-4">
            <Link to="/admin/messages">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-medium text-white">
                  3
                </span>
              </Button>
            </Link>
            
            <Link to="/">
              <Button variant="ghost" size="icon">
                <Home className="h-5 w-5" />
              </Button>
            </Link>

            <div className="h-8 w-px bg-gray-200" />

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name || 'Administrateur'}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 min-h-[calc(100vh-4rem)] border-r bg-white">
          <nav className="p-4 space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const targetPath = (item.path === '/admin' && isEmployee) ? '/admin/employe' : item.path;
              const isActive = location.pathname === targetPath;
              
              return (
                <Link key={targetPath} to={targetPath} className="no-underline">
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                      isActive 
                        ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-l-4 border-blue-600" 
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", isActive ? "text-blue-600" : "text-gray-400")} />
                    <span className="font-medium flex-1">{item.label}</span>
                    {item.badge === "unread" && (
                      <Badge variant="destructive" className="h-5 px-1.5 text-xs">3</Badge>
                    )}
                    {item.badge === "pending" && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">5</Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="lg:fixed lg:bottom-0 lg:left-0 lg:w-64 p-4 border-t border-gray-200 bg-white">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-gray-700 hover:text-rose-600 hover:bg-rose-50" 
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </aside>

        {/* Mobile Bottom Navigation */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-2 z-40">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const targetPath = (item.path === '/admin' && isEmployee) ? '/admin/employer' : item.path;
            const isActive = location.pathname === targetPath;
            
            return (
              <Link key={targetPath} to={targetPath} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center p-2 rounded-lg",
                  isActive ? "text-blue-600 bg-blue-50" : "text-gray-500"
                )}>
                  <Icon className="h-5 w-5 mb-1" />
                  <span className="text-xs">{item.label.split(' ')[0]}</span>
                </div>
              </Link>
            );
          })}
          <Link to="/admin/messages" className="flex-1">
            <div className={cn(
              "flex flex-col items-center p-2 rounded-lg relative",
              location.pathname === "/admin/messages" ? "text-blue-600 bg-blue-50" : "text-gray-500"
            )}>
              <Bell className="h-5 w-5 mb-1" />
              <span className="text-xs">Messages</span>
              <span className="absolute top-1 right-4 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-medium text-white">
                3
              </span>
            </div>
          </Link>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;