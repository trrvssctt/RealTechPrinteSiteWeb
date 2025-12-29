import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, ShoppingCart, DollarSign, TrendingUp, Calendar, TrendingDown, Users, ShoppingBag, Mail, ArrowUpRight, ArrowDownRight, Eye, BarChart3 } from "lucide-react";
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { apiFetch } from '@/lib/api';
import { fr } from "date-fns/locale";
import { useToast } from '@/hooks/use-toast';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import logo_realtech from '../../../assets/logo_realtech.png';

type TimeFilter = "today" | "7days" | "30days" | "month" | "all";

const CHART_COLORS = {
  primary: "hsl(214 100% 41%)",
  secondary: "hsl(0 0% 10%)",
  accent: "hsl(214 100% 55%)",
  muted: "hsl(214 20% 60%)",
  success: "hsl(142 72% 45%)",
  warning: "hsl(38 92% 50%)",
  danger: "hsl(0 84% 60%)",
  info: "hsl(199 89% 48%)",
};

const Dashboard = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30days");
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    previousRevenue: 0,
    previousOrders: 0,
    totalVisits: 0,
    previousVisits: 0,
    activeCarts: 0,
    abandonedCarts: 0,
    conversionRate: 0,
  });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [ordersData, setOrdersData] = useState<any[]>([]);
  const [categoriesData, setCategoriesData] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [timeFilter]);

  // Poll for new contact messages and show a toast when new ones arrive
  const lastCountRef = useRef<number | null>(null);
  const toastHook = useToast();

  useEffect(() => {
    let stopped = false;
    const token = localStorage.getItem('sessionToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const checkContacts = async () => {
      try {
        const resp = await apiFetch('/api/contacts?handled=false', { headers });
        if (!resp.ok) return;
        const json = await resp.json();
        const count = Array.isArray(json.results) ? json.results.length : 0;
        if (lastCountRef.current === null) {
          lastCountRef.current = count;
          setUnreadMessages(count);
        } else if (count > lastCountRef.current) {
          const delta = count - lastCountRef.current;
          lastCountRef.current = count;
          setUnreadMessages(count);
          toastHook.toast({ 
            title: `Nouveau${delta>1?'x':''} message${delta>1?'s':''}`,
            description: `${delta} nouveau${delta>1?'x':''} message${delta>1?'s':''} de contact`,
            variant: "default"
          });
        } else {
          lastCountRef.current = count;
          setUnreadMessages(count);
        }
      } catch (e) {
        // ignore polling errors
      }
    };

    checkContacts();
    const id = setInterval(() => { if (!stopped) checkContacts(); }, 30000);
    return () => { stopped = true; clearInterval(id); };
  }, []);

  const getDateRange = () => {
    const now = new Date();
    switch (timeFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "7days":
        return { start: subDays(now, 7), end: now };
      case "30days":
        return { start: subDays(now, 30), end: now };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: new Date(0), end: now };
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // Calculer la période précédente pour les comparaisons
      const duration = end.getTime() - start.getTime();
      const previousStart = new Date(start.getTime() - duration);
      const previousEnd = start;

      const token = localStorage.getItem('sessionToken');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Fetch products (public)
      const productsResp = await apiFetch('/api/products');
      const productsJson = await productsResp.json().catch(() => ({ data: [] }));
      const productsCount = Array.isArray(productsJson.data) ? productsJson.data.length : 0;

      // Fetch admin orders and carts (may require token)
      const [ordersResp, cartsResp] = await Promise.all([
        apiFetch('/api/admin/orders', { headers }),
        apiFetch('/api/admin/carts', { headers }),
      ]);

      const ordersJson = await ordersResp.json().catch(() => ({ data: [] }));
      const cartsJson = await cartsResp.json().catch(() => ({ data: [] }));

      const allOrders = Array.isArray(ordersJson.data) ? ordersJson.data : [];
      const allCarts = Array.isArray(cartsJson.data) ? cartsJson.data : [];

      // Filtrer par période
      const ordersInRange = allOrders.filter((o: any) => {
        const dateStr = o.created_at || o.placed_at || o.createdAt;
        const d = new Date(dateStr);
        return d >= start && d <= end;
      });
      const ordersPrevious = allOrders.filter((o: any) => {
        const dateStr = o.created_at || o.placed_at || o.createdAt;
        const d = new Date(dateStr);
        return d >= previousStart && d < previousEnd;
      });

      const revenue = ordersInRange.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);
      const previousRevenue = ordersPrevious.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);

      // Paniers: considérer last_activity_at si disponible, sinon updated_at
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const abandonedCarts = allCarts.filter((c: any) => {
        const last = c.last_activity_at || c.updated_at || c.updatedAt;
        if (!last) return false;
        return new Date(last) < twoHoursAgo;
      }).length;
      const activeCarts = Math.max((allCarts.length || 0) - abandonedCarts, 0);

      // Visits: fetch current and previous period counts from analytics endpoints
      let visitsCount = 0;
      let previousVisitsCount = 0;
      try {
        const visitsResp = await apiFetch(`/api/admin/visits?start=${startISO}&end=${endISO}`, { headers });
        if (visitsResp.ok) {
          const vjson = await visitsResp.json();
          visitsCount = vjson.count ?? (Array.isArray(vjson.data) ? vjson.data.length : 0);
        } else {
          const v2 = await apiFetch(`/api/analytics_visits?start=${startISO}&end=${endISO}`);
          if (v2.ok) {
            const vjson2 = await v2.json();
            visitsCount = vjson2.count ?? (Array.isArray(vjson2.data) ? vjson2.data.length : 0);
          }
        }
      } catch (e) {
        // ignore
      }

      try {
        const prevStartISO = previousStart.toISOString();
        const prevEndISO = previousEnd.toISOString();
        const prevResp = await apiFetch(`/api/admin/visits?start=${prevStartISO}&end=${prevEndISO}`, { headers });
        if (prevResp.ok) {
          const pj = await prevResp.json();
          previousVisitsCount = pj.count ?? (Array.isArray(pj.data) ? pj.data.length : 0);
        } else {
          const p2 = await apiFetch(`/api/analytics_visits?start=${prevStartISO}&end=${prevEndISO}`);
          if (p2.ok) {
            const pj2 = await p2.json();
            previousVisitsCount = pj2.count ?? (Array.isArray(pj2.data) ? pj2.data.length : 0);
          }
        }
      } catch (e) {
        // ignore
      }

      const totalVisits = visitsCount || 0;
      const totalOrders = allOrders.length;
      const conversionRate = totalVisits > 0 ? Math.round((totalOrders / totalVisits) * 100) : 0;

      // Préparer les données pour les graphiques
      const dailyRevenue = new Map<string, number>();
      const dailyOrders = new Map<string, number>();

      ordersInRange.forEach((order: any) => {
        const dateStr = order.created_at || order.placed_at || order.createdAt;
        const date = format(new Date(dateStr), 'dd/MM', { locale: fr });
        dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + Number(order.total_amount || 0));
        dailyOrders.set(date, (dailyOrders.get(date) || 0) + 1);
      });

      const revenueChartData = Array.from(dailyRevenue.entries()).map(([date, amount]) => ({ 
        date, 
        montant: Math.round(amount),
        name: date
      })).sort((a, b) => a.date.localeCompare(b.date));

      const ordersChartData = Array.from(dailyOrders.entries()).map(([date, count]) => ({ 
        date, 
        commandes: count,
        name: date 
      })).sort((a, b) => a.date.localeCompare(b.date));

      // Catégories: agréger depuis les order_items
      const categoryMap = new Map<string, number>();
      ordersInRange.forEach((order: any) => {
        const items = order.order_items || order.items || [];
        items.forEach((item: any) => {
          const categoryName = item.category_name || (item.product && item.product.category) || 'Non catégorisé';
          const price = Number(item.total_price || item.unit_price || 0);
          categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + price * (item.quantity || 1));
        });
      });

      const categoriesChartData = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value);

      setStats({
        totalProducts: productsCount || 0,
        totalOrders: totalOrders || 0,
        totalRevenue: revenue,
        pendingOrders: allOrders.filter((o: any) => o.status === 'pending').length || 0,
        previousRevenue,
        previousOrders: ordersPrevious.length || 0,
        totalVisits,
        previousVisits: previousVisitsCount || 0,
        activeCarts,
        abandonedCarts,
        conversionRate,
      });
      setRevenueData(revenueChartData);
      setOrdersData(ordersChartData);
      setCategoriesData(categoriesChartData);
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const revenueChange = calculateChange(stats.totalRevenue, stats.previousRevenue);
  const ordersChange = calculateChange(stats.totalOrders, stats.previousOrders);
  const visitsChange = calculateChange(stats.totalVisits, stats.previousVisits);

  const statCards = [
    {
      title: "Messages non lus",
      value: unreadMessages,
      icon: Mail,
      change: null,
      color: "bg-gradient-to-br from-pink-500 to-rose-600",
      iconColor: "text-pink-100",
      link: "/admin/contact",
      description: "Messages en attente"
    },
    {
      title: "Visites",
      value: stats.totalVisits.toLocaleString(),
      icon: Eye,
      change: visitsChange,
      color: "bg-gradient-to-br from-blue-500 to-indigo-600",
      iconColor: "text-blue-100",
      description: "Visiteurs uniques"
    },
    {
      title: "Commandes",
      value: stats.totalOrders,
      icon: ShoppingCart,
      change: ordersChange,
      color: "bg-gradient-to-br from-emerald-500 to-green-600",
      iconColor: "text-emerald-100",
      description: "Commandes totales"
    },
    {
      title: "Revenu Total",
      value: `${stats.totalRevenue.toLocaleString()} FCFA`,
      icon: DollarSign,
      change: revenueChange,
      color: "bg-gradient-to-br from-violet-500 to-purple-600",
      iconColor: "text-violet-100",
      description: "Chiffre d'affaires"
    },
  ];

  const secondaryCards = [
    {
      title: "Produits",
      value: stats.totalProducts,
      icon: Package,
      color: "bg-gradient-to-br from-amber-500 to-orange-500",
      link: "/admin/products"
    },
    {
      title: "Paniers Actifs",
      value: stats.activeCarts,
      icon: ShoppingBag,
      color: "bg-gradient-to-br from-cyan-500 to-teal-500",
      link: "/admin/carts"
    },
    {
      title: "Paniers Abandonnés",
      value: stats.abandonedCarts,
      icon: TrendingDown,
      color: "bg-gradient-to-br from-rose-500 to-red-500",
      link: "/admin/carts"
    },
    {
      title: "Taux de Conversion",
      value: `${stats.conversionRate}%`,
      icon: TrendingUp,
      color: "bg-gradient-to-br from-sky-500 to-blue-500"
    }
  ];

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Header with Logo and Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg shadow-sm border">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded flex items-center justify-center">
              <span className="text-white font-bold text-lg">RT</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tableau de Bord</h1>
            <p className="text-muted-foreground mt-1">RealTech Holding - Vue d'ensemble de l'activité</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 text-sm">
            {format(new Date(), 'dd MMMM yyyy', { locale: fr })}
          </Badge>
          <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)}>
            <SelectTrigger className="w-[180px] bg-white">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="7days">7 derniers jours</SelectItem>
              <SelectItem value="30days">30 derniers jours</SelectItem>
              <SelectItem value="month">Mois en cours</SelectItem>
              <SelectItem value="all">Tout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/admin/messages">
          <Card className="border-2 border-dashed border-muted hover:border-primary/50 transition-all cursor-pointer hover:shadow-md">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Voir les Messages</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {unreadMessages > 0 ? `${unreadMessages} non lu${unreadMessages > 1 ? 's' : ''}` : 'Aucun message'}
              </p>
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/admin/orders">
          <Card className="border-2 border-dashed border-muted hover:border-emerald-500/50 transition-all cursor-pointer hover:shadow-md">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <ShoppingCart className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-lg">Gérer les Commandes</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.pendingOrders > 0 ? `${stats.pendingOrders} en attente` : 'Toutes traitées'}
              </p>
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/admin/products">
          <Card className="border-2 border-dashed border-muted hover:border-amber-500/50 transition-all cursor-pointer hover:shadow-md">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                <Package className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="font-semibold text-lg">Produits</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.totalProducts} produits en stock
              </p>
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/admin/carts">
          <Card className="border-2 border-dashed border-muted hover:border-cyan-500/50 transition-all cursor-pointer hover:shadow-md">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center mb-3">
                <ShoppingBag className="h-6 w-6 text-cyan-600" />
              </div>
              <h3 className="font-semibold text-lg">Paniers</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.activeCarts} actifs · {stats.abandonedCarts} abandonnés
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          const hasPositiveChange = card.change !== null && card.change >= 0;
          
          return (
            <Card key={card.title} className="overflow-hidden border border-border hover:shadow-lg transition-all duration-300">
              <CardHeader className={`${card.color} text-white p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">{card.title}</CardTitle>
                    <p className="text-white/80 text-sm mt-1">{card.description}</p>
                  </div>
                  <div className={`p-3 rounded-full bg-white/20 ${card.iconColor}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-8">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-foreground">{card.value}</p>
                    {card.change !== null && (
                      <div className={`flex items-center gap-2 mt-3 ${hasPositiveChange ? "text-emerald-600" : "text-rose-600"}`}>
                        {hasPositiveChange ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">{Math.abs(card.change)}%</span>
                        <span className="text-sm text-muted-foreground">vs période précédente</span>
                      </div>
                    )}
                  </div>
                  {card.link && (
                    <Link to={card.link}>
                      <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20">
                        Voir
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} to={card.link || '#'} className={card.link ? 'no-underline' : ''}>
              <Card className="overflow-hidden hover:shadow-md transition-all duration-300 border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">{card.title}</p>
                      <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${card.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="border hover:shadow-md transition-shadow">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Chiffre d'affaires</CardTitle>
                <CardDescription>Évolution du revenu sur la période</CardDescription>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value) => [`${value} FCFA`, 'Revenu']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="montant" 
                  stroke={CHART_COLORS.primary} 
                  strokeWidth={3}
                  dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders Chart */}
        <Card className="border hover:shadow-md transition-shadow">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Commandes par jour</CardTitle>
                <CardDescription>Volume quotidien des commandes</CardDescription>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ordersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value) => [`${value} commandes`, 'Volume']}
                />
                <Bar 
                  dataKey="commandes" 
                  fill={CHART_COLORS.accent} 
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Categories Chart */}
        <Card className="lg:col-span-2 border hover:shadow-md transition-shadow">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Répartition par catégorie</CardTitle>
                <CardDescription>Ventes par catégorie de produits</CardDescription>
              </div>
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                <Package className="h-4 w-4 text-violet-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoriesData.slice(0, 5)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  >
                    {categoriesData.slice(0, 5).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={[
                          CHART_COLORS.primary,
                          CHART_COLORS.accent,
                          CHART_COLORS.success,
                          CHART_COLORS.warning,
                          CHART_COLORS.danger
                        ][index % 5]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value) => [`${value} FCFA`, 'Ventes']}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Categories List */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Top Catégories</h3>
                <div className="space-y-3">
                  {categoriesData.slice(0, 5).map((category, index) => {
                    const total = categoriesData.reduce((sum, cat) => sum + cat.value, 0);
                    const percentage = total > 0 ? (category.value / total * 100).toFixed(1) : 0;
                    
                    return (
                      <div key={category.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: [
                                CHART_COLORS.primary,
                                CHART_COLORS.accent,
                                CHART_COLORS.success,
                                CHART_COLORS.warning,
                                CHART_COLORS.danger
                              ][index % 5]
                            }}
                          />
                          <span className="font-medium">{category.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{category.value.toLocaleString()} FCFA</p>
                          <p className="text-sm text-muted-foreground">{percentage}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg font-medium">Chargement des données...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;