import { Link, Outlet, useLocation } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logo from '@/assets/logo_realtech.svg';
import { 
  LayoutDashboard, 
  Package, 
  FolderTree, 
  ShoppingCart, 
  MessageSquare, 
  Phone,
  LogOut,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

const AdminLayout = () => {
  const { isAdmin, loading, user } = useAdmin();
  const location = useLocation();

  const handleLogout = async () => {
    // Clear local session token and redirect to login
    try {
      localStorage.removeItem('sessionToken');
      toast.success("Déconnexion réussie");
      window.location.href = '/ne_ka_connection_page';
    } catch (err) {
      console.error('Logout error', err);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const navItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Tableau de bord" },
    { path: "/admin/products", icon: Package, label: "Produits" },
    { path: "/admin/categories", icon: FolderTree, label: "Catégories" },
    { path: "/admin/orders", icon: ShoppingCart, label: "Commandes" },
    { path: "/admin/carts", icon: ShoppingCart, label: "Paniers" },
    { path: "/admin/testimonials", icon: MessageSquare, label: "Témoignages" },
    { path: "/admin/contact", icon: Phone, label: "Contact" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border">
        <div className="p-6 border-b border-border flex items-center space-x-3">
          <img src={logo} alt="RealTech" className="w-10 h-10 rounded-md object-cover" />
          <div>
            <h2 className="text-xl font-bold text-primary">RealTech Admin</h2>
            <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
          </div>
        </div>
        
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start text-destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </aside>

      <main className="ml-64 p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;