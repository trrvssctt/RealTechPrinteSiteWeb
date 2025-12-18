import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, DollarSign, TrendingUp, Calendar, TrendingDown, Users, ShoppingBag } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { apiFetch } from '@/lib/api';
import { fr } from "date-fns/locale";

type TimeFilter = "today" | "7days" | "30days" | "month" | "all";

const CHART_COLORS = {
  primary: "hsl(214 100% 41%)",
  secondary: "hsl(0 0% 10%)",
  accent: "hsl(214 100% 55%)",
  muted: "hsl(214 20% 60%)",
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
    activeCarts: 0,
    abandonedCarts: 0,
    conversionRate: 0,
  });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [ordersData, setOrdersData] = useState<any[]>([]);
  const [categoriesData, setCategoriesData] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, [timeFilter]);

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

    // Visits: try multiple possible analytics endpoints (admin or public)
    let visitsJson: any = { data: [], count: 0 };
    try {
      // prefer an admin stats endpoint with date range
      const visitsResp = await apiFetch(`/api/admin/visits?start=${startISO}&end=${endISO}`, { headers });
      if (visitsResp.ok) {
        visitsJson = await visitsResp.json();
      } else {
        // fallback to public analytics table endpoint
        const v2 = await apiFetch(`/api/analytics_visits?start=${startISO}&end=${endISO}`);
        visitsJson = v2.ok ? await v2.json() : visitsJson;
      }
    } catch (e) {
      // ignore and keep visitsJson default
    }

    const visitsCountAll = visitsJson?.count ?? (Array.isArray(visitsJson?.data) ? visitsJson.data.length : 0);
    // if backend returned items, use length filtered by date range, else use count
    const visitsInRange = Array.isArray(visitsJson?.data)
      ? visitsJson.data.filter((v: any) => {
          const d = new Date(v.created_at || v.timestamp || v.createdAt);
          return d >= start && d <= end;
        }).length
      : visitsCountAll;

    const totalVisits = visitsInRange || 0;

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

    const revenueChartData = Array.from(dailyRevenue.entries()).map(([date, amount]) => ({ date, montant: Math.round(amount) }));
    const ordersChartData = Array.from(dailyOrders.entries()).map(([date, count]) => ({ date, commandes: count }));

    // Catégories: agréger depuis les order_items si présents
    const categoryMap = new Map<string, number>();
    ordersInRange.forEach((order: any) => {
      const items = order.order_items || order.items || [];
      items.forEach((item: any) => {
        const categoryName = item.category_name || (item.product && item.product.category) || 'Non catégorisé';
        const price = Number(item.total_price || item.unit_price || 0);
        categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + price * (item.quantity || 1));
      });
    });

    const categoriesChartData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));

    setStats({
      totalProducts: productsCount || 0,
      totalOrders: totalOrders || 0,
      totalRevenue: revenue,
      pendingOrders: allOrders.filter((o: any) => o.status === 'pending').length || 0,
      previousRevenue,
      previousOrders: ordersPrevious.length || 0,
      totalVisits,
      activeCarts,
      abandonedCarts,
      conversionRate,
    });
    setRevenueData(revenueChartData);
    setOrdersData(ordersChartData);
    setCategoriesData(categoriesChartData);
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const revenueChange = calculateChange(stats.totalRevenue, stats.previousRevenue);
  const ordersChange = calculateChange(stats.totalOrders, stats.previousOrders);

  const statCards = [
    {
      title: "Visites",
      value: stats.totalVisits,
      icon: Users,
      change: null,
      gradient: "from-primary to-primary-foreground"
    },
    {
      title: "Total Commandes",
      value: stats.totalOrders,
      icon: ShoppingCart,
      change: ordersChange,
      gradient: "from-accent to-accent-foreground"
    },
    {
      title: "Revenu Total",
      value: `${stats.totalRevenue.toLocaleString()} FCFA`,
      icon: DollarSign,
      change: revenueChange,
      gradient: "from-secondary to-secondary-foreground"
    },
    {
      title: "Paniers Actifs",
      value: stats.activeCarts,
      icon: ShoppingBag,
      change: null,
      gradient: "from-green-500 to-green-600"
    },
    {
      title: "Paniers Abandonnés",
      value: stats.abandonedCarts,
      icon: TrendingDown,
      change: null,
      gradient: "from-orange-500 to-orange-600"
    },
    {
      title: "Taux de Conversion",
      value: `${stats.conversionRate}%`,
      icon: TrendingUp,
      change: null,
      gradient: "from-blue-500 to-blue-600"
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tableau de Bord</h1>
          <p className="text-muted-foreground mt-2">Aperçu de votre activité RealTech Holding</p>
        </div>
        
        <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)}>
          <SelectTrigger className="w-[200px]">
            <Calendar className="mr-2 h-4 w-4" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          const hasPositiveChange = card.change !== null && card.change >= 0;
          const TrendIcon = hasPositiveChange ? TrendingUp : TrendingDown;
          
          return (
            <Card key={card.title} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className={`bg-gradient-to-br ${card.gradient} text-white`}>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-lg">{card.title}</span>
                  <Icon className="h-6 w-6" />
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-3xl font-bold">{card.value}</p>
                {card.change !== null && (
                  <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${hasPositiveChange ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    <TrendIcon className="h-4 w-4" />
                    <span>{Math.abs(card.change)}%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Chiffre d'affaires</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Line type="monotone" dataKey="montant" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ fill: CHART_COLORS.primary }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commandes par jour</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ordersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Bar dataKey="commandes" fill={CHART_COLORS.accent} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Répartition par catégorie</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoriesData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill={CHART_COLORS.primary}
                  dataKey="value"
                >
                  {categoriesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={[CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.secondary, CHART_COLORS.muted][index % 4]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;