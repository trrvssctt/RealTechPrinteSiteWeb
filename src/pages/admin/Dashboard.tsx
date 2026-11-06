import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, ShoppingCart, DollarSign, TrendingUp, Calendar, TrendingDown, Users, ShoppingBag, Mail, ArrowUpRight, ArrowDownRight, Eye, BarChart3, Wallet, Activity, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { differenceInHours, format, startOfDay, endOfDay } from "date-fns";
import { buildSeries, categoryBreakdown, getPeriod, isSiteOrder, orderDate, sumRevenue, topCategories, type TimeFilter } from "@/lib/dashboardStats";
import { apiFetch } from '@/lib/api';
import { fr } from "date-fns/locale";
import { useToast } from '@/hooks/use-toast';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import logo_realtech from '../../../assets/logo_realtech.png';

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

const CATEGORY_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
  CHART_COLORS.info,
  CHART_COLORS.muted,
];

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
  const [dailyStats, setDailyStats] = useState({
    todayRevenue: 0,
    todayDepensesValidees: 0,
    todayDepensesEnAttente: 0,
    todayOrdersCount: 0,
  });

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
    const id = setInterval(() => { if (!stopped && !document.hidden) checkContacts(); }, 30000);
    return () => { stopped = true; clearInterval(id); };
  }, []);

  // Visiteurs uniques du site (pages d'administration exclues)
  const fetchVisitors = async (start: Date, end: Date, headers: Record<string, string>) => {
    try {
      const resp = await apiFetch(`/api/admin/visits?start=${start.toISOString()}&end=${end.toISOString()}&public=1&limit=1`, { headers });
      if (!resp.ok) return 0;
      return (await resp.json()).unique_count || 0;
    } catch (e) {
      return 0;
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const period = getPeriod(timeFilter);
      const inRange = (o: any, start: Date, end: Date) => {
        const d = orderDate(o);
        return d >= start && d <= end;
      };

      const token = localStorage.getItem('sessionToken');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [productsResp, ordersResp, cartsResp] = await Promise.all([
        apiFetch('/api/products/all?limit=1000', { headers }),
        apiFetch('/api/admin/orders', { headers }),
        apiFetch('/api/admin/carts', { headers }),
      ]);
      if (!ordersResp.ok) throw new Error(`Commandes : HTTP ${ordersResp.status}`);

      const productsJson = await productsResp.json().catch(() => ({ data: [] }));
      const ordersJson = await ordersResp.json().catch(() => ({ data: [] }));
      const cartsJson = await cartsResp.json().catch(() => ({ data: [] }));

      const productsCount = (Array.isArray(productsJson.data) ? productsJson.data : [])
        .filter((p: any) => p.is_active !== false).length;

      // Les commandes annulées ne sont comptées nulle part dans le tableau de bord
      const allOrders = (Array.isArray(ordersJson.data) ? ordersJson.data : [])
        .filter((o: any) => o.status !== 'cancelled');
      const allCarts = Array.isArray(cartsJson.data) ? cartsJson.data : [];

      // ── Bilan journalier ────────────────────────────────────────────────────
      const now = new Date();
      const todayISO = format(now, 'yyyy-MM-dd');
      const todayOrders = allOrders.filter((o: any) => inRange(o, startOfDay(now), endOfDay(now)));

      let todayDepensesValidees = 0;
      let todayDepensesEnAttente = 0;
      try {
        const depResp = await apiFetch(`/api/admin/depenses?date_debut=${todayISO}&date_fin=${todayISO}`, { headers });
        if (depResp.ok) {
          const depJson = await depResp.json();
          const totaux: any[] = depJson.totaux || [];
          todayDepensesValidees = Number(totaux.find((t) => t.statut === 'valide')?.total || 0);
          todayDepensesEnAttente = Number(totaux.find((t) => t.statut === 'en_attente')?.nb || 0);
        }
      } catch (e) { /* ignore */ }

      setDailyStats({
        todayRevenue: sumRevenue(todayOrders),
        todayDepensesValidees,
        todayDepensesEnAttente,
        todayOrdersCount: todayOrders.length,
      });
      // ────────────────────────────────────────────────────────────────────────

      // Filtrer par période
      const ordersInRange = allOrders.filter((o: any) => inRange(o, period.start, period.end));
      const ordersPrevious = period.previous
        ? allOrders.filter((o: any) => inRange(o, period.previous!.start, period.previous!.end) && orderDate(o) < period.previous!.end)
        : [];

      // Mêmes règles que la page Paniers : uniquement les paniers encore actifs
      const openCarts = allCarts.filter((c: any) => c.status === 'active');
      const abandonedCarts = openCarts.filter((c: any) => {
        const last = c.last_activity_at || c.updated_at || c.updatedAt;
        return !!last && differenceInHours(now, new Date(last)) > 2;
      }).length;
      const activeCarts = openCarts.length - abandonedCarts;

      const [totalVisits, previousVisits] = await Promise.all([
        fetchVisitors(period.start, period.end, headers),
        period.previous ? fetchVisitors(period.previous.start, period.previous.end, headers) : Promise.resolve(0),
      ]);

      // Conversion : commandes passées sur le site / visiteurs (les saisies du personnel n'en sont pas)
      const siteOrders = ordersInRange.filter(isSiteOrder).length;
      const conversionRate = totalVisits > 0 ? Math.round((siteOrders / totalVisits) * 1000) / 10 : 0;

      const series = buildSeries(ordersInRange, period, timeFilter === 'all');

      setStats({
        totalProducts: productsCount,
        totalOrders: ordersInRange.length,
        totalRevenue: sumRevenue(ordersInRange),
        pendingOrders: allOrders.filter((o: any) => o.status === 'pending').length,
        previousRevenue: sumRevenue(ordersPrevious),
        previousOrders: ordersPrevious.length,
        totalVisits,
        previousVisits,
        activeCarts,
        abandonedCarts,
        conversionRate,
      });
      setRevenueData(series.revenue);
      setOrdersData(series.orders);
      setCategoriesData(categoryBreakdown(ordersInRange));
    } catch (error: any) {
      console.error('Erreur lors du chargement des stats:', error);
      toastHook.toast({
        title: 'Statistiques non chargées',
        description: error?.message || 'Réessayez dans un instant.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Évolution en % : rien à afficher sans période de comparaison ou si elle est à zéro
  const calculateChange = (current: number, previous: number) => {
    if (timeFilter === 'all' || previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  };

  const revenueChange = calculateChange(stats.totalRevenue, stats.previousRevenue);
  const ordersChange = calculateChange(stats.totalOrders, stats.previousOrders);
  const visitsChange = calculateChange(stats.totalVisits, stats.previousVisits);

  const categoriesTotal = categoriesData.reduce((sum, cat) => sum + cat.value, 0);
  const categoriesShown = topCategories(categoriesData);

  const statCards = [
    {
      title: "Messages non lus",
      value: unreadMessages,
      icon: Mail,
      change: null,
      color: "bg-gradient-to-br from-pink-500 to-rose-600",
      iconColor: "text-pink-100",
      link: "/admin/messages",
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
      description: "Sur la période, hors annulées"
    },
    {
      title: "Revenu Total",
      value: `${stats.totalRevenue.toLocaleString('fr-FR')} FCFA`,
      icon: DollarSign,
      change: revenueChange,
      color: "bg-gradient-to-br from-violet-500 to-purple-600",
      iconColor: "text-violet-100",
      description: "Ventes terminées ou en cours"
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
                {stats.totalProducts} produits actifs
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

      {/* Bilan du Jour */}
      {(() => {
        const benefice = dailyStats.todayRevenue - dailyStats.todayDepensesValidees;
        const isProfit = benefice > 0;
        const isLoss = benefice < 0;
        return (
          <Card className={`border-2 ${isProfit ? 'border-emerald-300 bg-emerald-50/30' : isLoss ? 'border-rose-300 bg-rose-50/30' : 'border-amber-300 bg-amber-50/30'}`}>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className={`h-5 w-5 ${isProfit ? 'text-emerald-600' : isLoss ? 'text-rose-600' : 'text-amber-600'}`} />
                  <CardTitle className="text-lg">Bilan du Jour</CardTitle>
                  <span className="text-sm text-muted-foreground">— {format(new Date(), 'dd MMMM yyyy', { locale: fr })}</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold w-fit ${
                  isProfit ? 'bg-emerald-100 text-emerald-700' :
                  isLoss   ? 'bg-rose-100 text-rose-700' :
                             'bg-amber-100 text-amber-700'
                }`}>
                  {isProfit ? <CheckCircle className="h-4 w-4" /> : isLoss ? <AlertCircle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  {isProfit ? 'Bénéficiaire' : isLoss ? 'Déficitaire' : 'À l\'équilibre'}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Commandes</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{dailyStats.todayOrdersCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">reçues aujourd'hui</p>
                </div>
                <div className="bg-white rounded-xl p-4 border shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gains</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{dailyStats.todayRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">FCFA (ventes terminées ou en cours)</p>
                </div>
                <div className="bg-white rounded-xl p-4 border shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-4 w-4 text-rose-500" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dépenses</span>
                  </div>
                  <p className="text-2xl font-bold text-rose-600">{dailyStats.todayDepensesValidees.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    FCFA validées
                    {dailyStats.todayDepensesEnAttente > 0 && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600 font-medium">
                        <Clock className="h-3 w-3" />{dailyStats.todayDepensesEnAttente} en attente
                      </span>
                    )}
                  </p>
                </div>
                <div className={`rounded-xl p-4 border shadow-sm ${isProfit ? 'bg-emerald-500' : isLoss ? 'bg-rose-500' : 'bg-amber-400'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="h-4 w-4 text-white/80" />
                    <span className="text-xs font-medium text-white/80 uppercase tracking-wide">Bénéfice net</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{benefice >= 0 ? '+' : ''}{benefice.toLocaleString()}</p>
                  <p className="text-xs text-white/70 mt-0.5">FCFA aujourd'hui</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

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
                      <Button variant="outline" size="sm">
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
                <CardDescription>Ventes terminées ou en cours, sur la période</CardDescription>
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
                  formatter={(value) => [`${Number(value).toLocaleString('fr-FR')} FCFA`, 'Revenu']}
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
                  maxBarSize={40}
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
                <CardDescription>Chiffre d'affaires de la période : produits par catégorie et services</CardDescription>
              </div>
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                <Package className="h-4 w-4 text-violet-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {categoriesShown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Aucune vente sur cette période.</p>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoriesShown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoriesShown.map((entry, index) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value, name) => [`${Number(value).toLocaleString('fr-FR')} FCFA`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Categories List */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Top Catégories</h3>
                <div className="space-y-3">
                  {categoriesShown.map((category, index) => (
                    <div key={category.name} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                        />
                        <span className="font-medium truncate">{category.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">{category.value.toLocaleString('fr-FR')} FCFA</p>
                        <p className="text-sm text-muted-foreground">
                          {categoriesTotal > 0 ? (category.value / categoriesTotal * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}
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