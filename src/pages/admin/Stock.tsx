import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Plus, Filter, Download, Search, TrendingUp, Package, 
  ArrowUpRight, ArrowDownRight, Calendar, RefreshCw 
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
// do not use useAdmin here (it redirects non-admins); fetch current user locally
import { DatePickerWithRange } from '@/components/ui/date-range-picker';

const StockImproved = () => {
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('30days');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  // Modal states
  const [openCreate, setOpenCreate] = useState(false);
  const [createProduct, setCreateProduct] = useState<string | null>(null);
  const [createQty, setCreateQty] = useState<number>(1);
  const [createSubtype, setCreateSubtype] = useState<string>('reaprovisonnement');
  const [createRef, setCreateRef] = useState<string>('');
  const [createNote, setCreateNote] = useState('');
  const [creating, setCreating] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [isEmployee, setIsEmployee] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchProducts();
    fetchMovements();

    // detect if current user is an employee (allow view but no write)
    (async () => {
      try {
        const resp = await apiFetch('/api/users/me');
        if (!resp.ok) return;
        const j = await resp.json().catch(() => ({}));
        const u = j.user || j.data || j;
        setUser(u);
        const roles = u?.roles || u?.role_names || u?.role || [];
        const roleList = Array.isArray(roles) ? roles : (typeof roles === 'string' ? [roles] : []);
        const isEmp = roleList.some(r => typeof r === 'string' && ['employe','employé','employee','staff'].includes(r.toLowerCase()));
        setIsEmployee(Boolean(isEmp));
      } catch (err) {
        // ignore
      }
    })();
  }, []);

  // Fetch movements when filters change
  useEffect(() => {
    fetchMovements();
  }, [filterProduct, filterType, timeFilter]);

  // Fetch all products
  const fetchProducts = async () => {
    try {
      const resp = await apiFetch('/api/products?limit=1000');
      if (!resp.ok) return;
      const j = await resp.json().catch(() => ({ data: [] }));
      setProducts(Array.isArray(j.data) ? j.data : []);
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors du chargement des produits');
    }
  };

  // Fetch filtered movements
  const fetchMovements = async () => {
    setLoading(true);
    try {
      const qs = [];
      if (filterProduct && filterProduct !== 'all') {
        qs.push(`product_id=${encodeURIComponent(filterProduct)}`);
      }
      if (filterType && filterType !== 'all') {
        qs.push(`movement_type=${encodeURIComponent(filterType)}`);
      }
      
      const now = new Date();
      let start = null;
      if (timeFilter === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      }
      if (timeFilter === '7days') {
        start = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
      }
      if (timeFilter === '30days') {
        start = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
      }
      if (start) qs.push(`start=${encodeURIComponent(start)}`);

      const url = '/api/admin/stock-mouvements' + (qs.length ? `?${qs.join('&')}` : '');
      const resp = await apiFetch(url);
      if (!resp.ok) throw new Error('Failed to load movements');
      
      const j = await resp.json();
      setMovements(Array.isArray(j.data) ? j.data : []);
    } catch (e) {
      console.error(e);
      toast.error('Impossible de charger les mouvements');
    } finally {
      setLoading(false);
    }
  };

  // Filter movements by search query
  const filteredMovements = useMemo(() => {
    return movements.filter(movement => {
      const productName = (movement.product?.name || movement.product_name || '').toLowerCase();
      const reference = (movement.reference || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      
      return productName.includes(query) || 
             reference.includes(query) || 
             movement.movement_type.includes(query);
    });
  }, [movements, searchQuery]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalIn = movements
      .filter(m => m.movement_type === 'in')
      .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    
    const totalOut = movements
      .filter(m => m.movement_type === 'out')
      .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    
    const netChange = totalIn - totalOut;
    const uniqueProducts = new Set(movements.map(m => m.product_id)).size;
    
    return { totalIn, totalOut, netChange, uniqueProducts };
  }, [movements]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const map = new Map();
    movements.forEach(m => {
      const date = new Date(m.created_at || m.createdAt || m.created);
      const dateKey = date.toISOString().slice(0, 10);
      
      if (!map.has(dateKey)) {
        map.set(dateKey, { 
          date: dateKey, 
          formattedDate: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          in: 0, 
          out: 0,
          net: 0
        });
      }
      
      const obj = map.get(dateKey);
      if (m.movement_type === 'in') {
        obj.in += Number(m.quantity || 0);
        obj.net += Number(m.quantity || 0);
      } else {
        obj.out += Number(m.quantity || 0);
        obj.net -= Number(m.movement_type === 'out' ? m.quantity || 0 : 0);
      }
      
      map.set(dateKey, obj);
    });
    
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-15); // Show last 15 days
  }, [movements]);

  // Prepare product distribution data for pie chart
  const productDistributionData = useMemo(() => {
    const distribution = new Map();
    
    movements.forEach(m => {
      const productName = m.product?.name || m.product_name || 'Inconnu';
      const quantity = Number(m.quantity) || 0;
      
      if (distribution.has(productName)) {
        distribution.set(productName, distribution.get(productName) + quantity);
      } else {
        distribution.set(productName, quantity);
      }
    });
    
    return Array.from(distribution.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 products
  }, [movements]);

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#8DD1E1'];

  const createMovement = async () => {
    if (isEmployee) {
      toast.error('Permission refusée');
      return;
    }
    if (!createProduct) {
      toast.error('Sélectionnez un produit');
      return;
    }
    if (!createQty || createQty <= 0) {
      toast.error('Quantité invalide');
      return;
    }
    
    setCreating(true);
    try {
      const payload = {
        product_id: createProduct,
        movement_type: 'in',
        movement_subtype: createSubtype,
        quantity: Number(createQty),
        reference: createRef || null,
        note: createNote || null,
        unit_cost: null,
        metadata: { 
          created_via: 'admin_stock_page',
          created_by: user?.id 
        }
      };
      
      const resp = await apiFetch('/api/admin/stock-mouvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!resp.ok) throw new Error('Erreur création');
      
      toast.success('Entrée de stock créée avec succès');
      setOpenCreate(false);
      resetCreateForm();
      fetchMovements();
      fetchProducts();
    } catch (e) {
      console.error(e);
      toast.error('Impossible de créer le mouvement');
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateProduct(null);
    setCreateQty(1);
    setCreateSubtype('reaprovisonnement');
    setCreateRef('');
    setCreateNote('');
  };

  const exportToCSV = () => {
    // Implement CSV export logic here
    toast.info('Export CSV en cours de développement');
  };

  const getStatusBadge = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'active': return <Badge variant="success">Actif</Badge>;
      case 'voided': return <Badge variant="destructive">Annulé</Badge>;
      default: return <Badge variant="secondary">{status || 'Inconnu'}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch(type?.toLowerCase()) {
      case 'in': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Entrée</Badge>;
      case 'out': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Sortie</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion du Stock</h1>
          <p className="text-gray-600 mt-1">
            Suivez et gérez les entrées et sorties de stock en temps réel
          </p>
        </div>
        <div className="flex gap-2">
          {!isEmployee && (
            <Button variant="outline" onClick={exportToCSV} className="gap-2">
              <Download size={16} />
              Exporter
            </Button>
          )}
          {!isEmployee && (
            <Button onClick={() => setOpenCreate(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus size={16} />
              Nouvelle Entrée
            </Button>
          )}
          {isEmployee && (
            <div className="text-sm text-gray-600 self-center">Accès lecture seule</div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Entrées totales</p>
                <h3 className="text-2xl font-bold mt-2">{summaryStats.totalIn}</h3>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <ArrowUpRight className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">30 derniers jours</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sorties totales</p>
                <h3 className="text-2xl font-bold mt-2">{summaryStats.totalOut}</h3>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <ArrowDownRight className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">30 derniers jours</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Variation nette</p>
                <h3 className={`text-2xl font-bold mt-2 ${summaryStats.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summaryStats.netChange >= 0 ? '+' : ''}{summaryStats.netChange}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Balance entrées/sorties</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Produits actifs</p>
                <h3 className="text-2xl font-bold mt-2">{summaryStats.uniqueProducts}</h3>
              </div>
              <div className="p-3 bg-purple-50 rounded-full">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Avec mouvements récents</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full md:w-auto grid-cols-2 md:grid-cols-3">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50">
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="movements" className="data-[state=active]:bg-blue-50">
            Mouvements
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-50">
            Analyse
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Line Chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Évolution des mouvements de stock
                </CardTitle>
                <CardDescription>
                  Entrées et sorties sur les 15 derniers jours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="formattedDate" 
                        stroke="#666"
                        fontSize={12}
                      />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="in" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="Entrées"
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="out" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        name="Sorties"
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Filters Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtres
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recherche</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Rechercher produit ou référence..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Produit</label>
                    <Select value={filterProduct} onValueChange={setFilterProduct}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tous les produits" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les produits</SelectItem>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Type</label>
                      <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous</SelectItem>
                          <SelectItem value="in">Entrée</SelectItem>
                          <SelectItem value="out">Sortie</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Période</label>
                      <Select value={timeFilter} onValueChange={setTimeFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Période" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Aujourd'hui</SelectItem>
                          <SelectItem value="7days">7 jours</SelectItem>
                          <SelectItem value="30days">30 jours</SelectItem>
                          <SelectItem value="all">Tout</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={fetchMovements} 
                      className="flex-1 gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Appliquer
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFilterProduct('all');
                        setFilterType('all');
                        setTimeFilter('30days');
                        setSearchQuery('');
                      }}
                      className="flex-1"
                    >
                      Réinitialiser
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Distribution par produit</CardTitle>
                <CardDescription>Top 8 produits les plus actifs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {productDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} unités`, 'Quantité']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>Historique des mouvements</CardTitle>
              <CardDescription>
                {filteredMovements.length} mouvements trouvés
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-semibold">Produit</TableHead>
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="font-semibold">Sous-type</TableHead>
                        <TableHead className="font-semibold">Quantité</TableHead>
                        <TableHead className="font-semibold">Référence</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            Aucun mouvement trouvé
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMovements.map(m => (
                          <TableRow key={m.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">
                              {m.product?.name || m.product_name || '-'}
                            </TableCell>
                            <TableCell>{getTypeBadge(m.movement_type)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {m.movement_subtype}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {m.quantity}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {m.reference || '-'}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {new Date(m.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </TableCell>
                            <TableCell>{getStatusBadge(m.status)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Volume mensuel</CardTitle>
                <CardDescription>Comparaison entrées/sorties</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {/* Bar chart for monthly comparison would go here */}
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="formattedDate" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="in" name="Entrées" fill="#10b981" />
                      <Bar dataKey="out" name="Sorties" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tendances</CardTitle>
                <CardDescription>Indicateurs de performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700">Taux de rotation</p>
                      <p className="text-2xl font-bold mt-1">2.4</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">Disponibilité moyenne</p>
                      <p className="text-2xl font-bold mt-1">94%</p>
                    </div>
                    <Package className="h-8 w-8 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Movement Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Nouvelle entrée de stock</DialogTitle>
            <DialogDescription>
              Ajoutez une nouvelle entrée de stock dans le système
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Produit *</label>
              <Select value={createProduct || ''} onValueChange={(v) => setCreateProduct(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un produit" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.current_stock !== undefined && `(Stock: ${p.current_stock})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantité *</label>
                <Input
                  type="number"
                  min="1"
                  value={createQty}
                  onChange={(e) => setCreateQty(Number(e.target.value))}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Type d'entrée</label>
                <Select value={createSubtype} onValueChange={setCreateSubtype}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reaprovisonnement">Réapprovisionnement</SelectItem>
                    <SelectItem value="livraison">Livraison</SelectItem>
                    <SelectItem value="retour">Retour client</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Référence (facultatif)</label>
              <Input
                placeholder="N° de bon, facture, etc."
                value={createRef}
                onChange={(e) => setCreateRef(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (facultatif)</label>
              <Textarea
                placeholder="Informations complémentaires..."
                value={createNote}
                onChange={(e) => setCreateNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Annuler
            </Button>
            <Button 
              onClick={createMovement} 
              disabled={creating || !createProduct}
              className="min-w-32"
            >
              {creating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer l\'entrée'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockImproved;