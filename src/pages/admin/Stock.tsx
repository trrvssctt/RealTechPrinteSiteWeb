import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Plus, Filter, Download, Search, TrendingUp, Package,
  ArrowUpRight, ArrowDownRight, RefreshCw, Loader2,
  ArrowUp, ArrowDown, User, Calendar, Hash, FileText,
  ChevronLeft, ChevronRight, AlertTriangle, Boxes,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ITEMS_PER_PAGE = 20;

const SUBTYPE_LABELS: Record<string, string> = {
  reaprovisonnement: 'Réapprovisionnement',
  livraison: 'Livraison',
  retour: 'Retour client',
  vente: 'Vente',
  ajustement: 'Ajustement',
  autre: 'Autre',
};

const Stock = () => {
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [timeFilter, setTimeFilter] = useState('30days');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Create dialog
  const [openCreate, setOpenCreate] = useState(false);
  const [createType, setCreateType] = useState<'in' | 'out'>('in');
  const [createProduct, setCreateProduct] = useState('');
  const [createQty, setCreateQty] = useState(1);
  const [createSubtype, setCreateSubtype] = useState('reaprovisonnement');
  const [createRef, setCreateRef] = useState('');
  const [createNote, setCreateNote] = useState('');
  const [creating, setCreating] = useState(false);

  const [isEmployee, setIsEmployee] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchMovements();
    (async () => {
      try {
        const resp = await apiFetch('/api/users/me');
        if (!resp.ok) return;
        const j = await resp.json().catch(() => ({}));
        const u = j.user || j.data || j;
        setUserId(u?.id || null);
        const roles = u?.roles || u?.role_names || u?.role || [];
        const roleList = Array.isArray(roles) ? roles : (typeof roles === 'string' ? [roles] : []);
        const isEmp = roleList.some((r: string) =>
          typeof r === 'string' && ['employe', 'employé', 'employee', 'staff'].includes(r.toLowerCase())
        );
        setIsEmployee(Boolean(isEmp));
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    fetchMovements();
    setCurrentPage(1);
  }, [filterProduct, filterType, timeFilter]);

  const fetchProducts = async () => {
    try {
      const resp = await apiFetch('/api/products?limit=1000');
      if (!resp.ok) return;
      const j = await resp.json().catch(() => ({ data: [] }));
      setProducts(Array.isArray(j.data) ? j.data : []);
    } catch (_) {}
  };

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const qs: string[] = [];
      if (filterProduct && filterProduct !== 'all') qs.push(`product_id=${encodeURIComponent(filterProduct)}`);
      if (filterType && filterType !== 'all') qs.push(`movement_type=${encodeURIComponent(filterType)}`);

      const now = new Date();
      if (timeFilter === 'today') {
        qs.push(`start=${encodeURIComponent(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())}`);
      } else if (timeFilter === '7days') {
        qs.push(`start=${encodeURIComponent(new Date(now.getTime() - 7 * 86400000).toISOString())}`);
      } else if (timeFilter === '30days') {
        qs.push(`start=${encodeURIComponent(new Date(now.getTime() - 30 * 86400000).toISOString())}`);
      }

      const resp = await apiFetch('/api/admin/stock-mouvements' + (qs.length ? `?${qs.join('&')}` : ''));
      if (!resp.ok) throw new Error();
      const j = await resp.json();
      setMovements(Array.isArray(j.data) ? j.data : []);
    } catch (_) {
      toast.error('Impossible de charger les mouvements');
    } finally {
      setLoading(false);
    }
  };

  const filteredMovements = useMemo(() => {
    if (!searchQuery.trim()) return movements;
    const q = searchQuery.toLowerCase();
    return movements.filter(m =>
      (m.product_name || '').toLowerCase().includes(q) ||
      (m.reference || '').toLowerCase().includes(q) ||
      (m.created_by_name || '').toLowerCase().includes(q) ||
      (m.movement_subtype || '').toLowerCase().includes(q)
    );
  }, [movements, searchQuery]);

  const totalPages = Math.ceil(filteredMovements.length / ITEMS_PER_PAGE);
  const pageMovements = filteredMovements.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const stats = useMemo(() => {
    const totalIn = movements.filter(m => m.movement_type === 'in').reduce((s, m) => s + Number(m.quantity || 0), 0);
    const totalOut = movements.filter(m => m.movement_type === 'out').reduce((s, m) => s + Number(m.quantity || 0), 0);
    const net = totalIn - totalOut;
    const uniqueProducts = new Set(movements.map(m => m.product_id)).size;
    return { totalIn, totalOut, net, uniqueProducts };
  }, [movements]);

  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; label: string; in: number; out: number }>();
    movements.forEach(m => {
      const d = new Date(m.created_at);
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) {
        map.set(key, {
          date: key,
          label: format(d, 'd MMM', { locale: fr }),
          in: 0,
          out: 0,
        });
      }
      const obj = map.get(key)!;
      if (m.movement_type === 'in') obj.in += Number(m.quantity || 0);
      else obj.out += Number(m.quantity || 0);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  }, [movements]);

  const handleCreate = async () => {
    if (!createProduct) { toast.error('Sélectionnez un produit'); return; }
    if (!createQty || createQty <= 0) { toast.error('Quantité invalide'); return; }

    setCreating(true);
    try {
      const resp = await apiFetch('/api/admin/stock-mouvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: createProduct,
          movement_type: createType,
          movement_subtype: createSubtype,
          quantity: Number(createQty),
          reference: createRef || null,
          note: createNote || null,
          metadata: { created_via: 'admin_stock_page', created_by: userId },
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (err.error === 'insufficient_stock') {
          toast.error('Stock insuffisant pour cette sortie');
          return;
        }
        throw new Error();
      }
      toast.success(`${createType === 'in' ? 'Entrée' : 'Sortie'} de stock enregistrée`);
      setOpenCreate(false);
      setCreateProduct('');
      setCreateQty(1);
      setCreateSubtype('reaprovisonnement');
      setCreateRef('');
      setCreateNote('');
      fetchMovements();
      fetchProducts();
    } catch (_) {
      toast.error('Impossible de créer le mouvement');
    } finally {
      setCreating(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Date', 'Produit', 'Type', 'Sous-type', 'Quantité', 'Référence', 'Créé par'],
      ...filteredMovements.map(m => [
        format(new Date(m.created_at), 'dd/MM/yyyy HH:mm'),
        m.product_name || '',
        m.movement_type === 'in' ? 'Entrée' : 'Sortie',
        SUBTYPE_LABELS[m.movement_subtype] || m.movement_subtype || '',
        m.quantity,
        m.reference || '',
        m.created_by_name || '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `mouvements_stock_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success(`${filteredMovements.length} mouvements exportés`);
  };

  const timePeriodLabel = { today: "Aujourd'hui", '7days': '7 derniers jours', '30days': '30 derniers jours', all: 'Toutes les périodes' }[timeFilter];

  const selectedProduct = products.find(p => p.id === createProduct);

  return (
    <div className="space-y-6 p-4">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <Boxes className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mouvements de stock</h1>
            <p className="text-muted-foreground mt-0.5">Suivez toutes les entrées et sorties en temps réel</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchMovements} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredMovements.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exporter CSV
          </Button>
          {!isEmployee && (
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau mouvement
            </Button>
          )}
          {isEmployee && (
            <Badge variant="secondary" className="py-1.5 px-3">Lecture seule</Badge>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Entrées</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">+{stats.totalIn}</p>
                <p className="text-xs text-muted-foreground mt-1">{timePeriodLabel}</p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ArrowUpRight className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Sorties</p>
                <p className="text-3xl font-bold text-red-600 mt-1">-{stats.totalOut}</p>
                <p className="text-xs text-muted-foreground mt-1">{timePeriodLabel}</p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-red-100 flex items-center justify-center">
                <ArrowDownRight className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Variation nette</p>
                <p className={`text-3xl font-bold mt-1 ${stats.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {stats.net >= 0 ? '+' : ''}{stats.net}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Entrées − Sorties</p>
              </div>
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${stats.net >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <TrendingUp className={`h-5 w-5 ${stats.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Produits touchés</p>
                <p className="text-3xl font-bold mt-1">{stats.uniqueProducts}</p>
                <p className="text-xs text-muted-foreground mt-1">Avec mouvements</p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher produit, référence, employé..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Select value={filterProduct} onValueChange={v => { setFilterProduct(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[200px]">
                  <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Tous les produits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les produits</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={v => { setFilterType(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="in">Entrées seulement</SelectItem>
                  <SelectItem value="out">Sorties seulement</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeFilter} onValueChange={v => { setTimeFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="7days">7 derniers jours</SelectItem>
                  <SelectItem value="30days">30 derniers jours</SelectItem>
                  <SelectItem value="all">Tout l'historique</SelectItem>
                </SelectContent>
              </Select>

              {(filterProduct !== 'all' || filterType !== 'all' || timeFilter !== '30days' || searchQuery) && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setFilterProduct('all'); setFilterType('all'); setTimeFilter('30days'); setSearchQuery(''); setCurrentPage(1);
                }}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Main content: table + chart ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Table */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Historique des mouvements</CardTitle>
                <CardDescription>
                  {filteredMovements.length} mouvement{filteredMovements.length !== 1 ? 's' : ''} · {timePeriodLabel}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-1 h-12 rounded-full" />
                    <Skeleton className="h-12 flex-1 rounded-md" />
                  </div>
                ))}
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-lg mb-1">Aucun mouvement trouvé</h3>
                <p className="text-muted-foreground text-sm">
                  {searchQuery || filterProduct !== 'all' || filterType !== 'all'
                    ? 'Essayez de modifier vos filtres'
                    : 'Aucun mouvement sur cette période'}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-2 p-0" />
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead className="text-center font-semibold">Qté</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead>Par</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageMovements.map(m => {
                        const isIn = m.movement_type === 'in';
                        return (
                          <TableRow key={m.id} className="hover:bg-muted/30">
                            {/* Color bar */}
                            <TableCell className="p-0 w-1">
                              <div className={`h-full w-1 min-h-[52px] rounded-l-sm ${isIn ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            </TableCell>

                            <TableCell>
                              <div className="font-medium text-sm">{m.product_name || '—'}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {SUBTYPE_LABELS[m.movement_subtype] || m.movement_subtype || '—'}
                              </div>
                            </TableCell>

                            <TableCell className="text-center">
                              {isIn ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2.5 py-1">
                                  <ArrowUp className="h-3 w-3" /> Entrée
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2.5 py-1">
                                  <ArrowDown className="h-3 w-3" /> Sortie
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              <span className={`text-lg font-bold ${isIn ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isIn ? '+' : '-'}{m.quantity}
                              </span>
                            </TableCell>

                            <TableCell>
                              {m.reference ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="font-mono text-xs">{m.reference}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>

                            <TableCell>
                              {m.created_by_name ? (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <User className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[100px]">{m.created_by_name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">Système</span>
                              )}
                            </TableCell>

                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(m.created_at), 'dd MMM yyyy', { locale: fr })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(m.created_at), 'HH:mm')}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredMovements.length)} sur {filteredMovements.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let n = i + 1;
                        if (totalPages > 5) {
                          if (currentPage <= 3) n = i + 1;
                          else if (currentPage >= totalPages - 2) n = totalPages - 4 + i;
                          else n = currentPage - 2 + i;
                        }
                        return (
                          <Button key={n} variant={currentPage === n ? 'default' : 'outline'} size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(n)}>
                            {n}
                          </Button>
                        );
                      })}
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activité récente</CardTitle>
              <CardDescription className="text-xs">Entrées vs Sorties par jour</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Pas de données</div>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={8} margin={{ left: -20, right: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" fontSize={10} tick={{ fill: '#888' }} />
                      <YAxis fontSize={10} tick={{ fill: '#888' }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        formatter={(v: any, name: string) => [v, name === 'in' ? 'Entrées' : 'Sorties']}
                      />
                      <Legend formatter={(v) => v === 'in' ? 'Entrées' : 'Sorties'} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="in" fill="#10b981" radius={[3, 3, 0, 0]} name="in" />
                      <Bar dataKey="out" fill="#ef4444" radius={[3, 3, 0, 0]} name="out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top produits */}
          {(() => {
            const topMap = new Map<string, number>();
            movements.forEach(m => {
              const name = m.product_name || 'Inconnu';
              topMap.set(name, (topMap.get(name) || 0) + Number(m.quantity || 0));
            });
            const top = Array.from(topMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
            if (top.length === 0) return null;
            const max = top[0][1];
            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Produits les plus actifs</CardTitle>
                  <CardDescription className="text-xs">Par volume total de mouvements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {top.map(([name, qty], i) => (
                    <div key={name}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium truncate flex-1 mr-2" title={name}>
                          {i + 1}. {name}
                        </span>
                        <span className="text-sm font-bold shrink-0">{qty}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                          style={{ width: `${(qty / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          {/* Répartition rapide */}
          {movements.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Répartition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-emerald-600 font-medium">Entrées</span>
                    <span className="font-semibold">{stats.totalIn > 0 ? Math.round((stats.totalIn / (stats.totalIn + stats.totalOut)) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: stats.totalIn + stats.totalOut > 0 ? `${(stats.totalIn / (stats.totalIn + stats.totalOut)) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-red-600 font-medium">Sorties</span>
                    <span className="font-semibold">{stats.totalOut > 0 ? Math.round((stats.totalOut / (stats.totalIn + stats.totalOut)) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: stats.totalIn + stats.totalOut > 0 ? `${(stats.totalOut / (stats.totalIn + stats.totalOut)) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nouveau mouvement de stock
            </DialogTitle>
            <DialogDescription>
              Enregistrez une entrée ou une sortie de stock
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setCreateType('in'); setCreateSubtype('reaprovisonnement'); }}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${createType === 'in' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-muted text-muted-foreground hover:border-emerald-200'}`}
              >
                <ArrowUp className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Entrée</div>
                  <div className="text-xs opacity-70">Réception de stock</div>
                </div>
              </button>
              <button
                onClick={() => { setCreateType('out'); setCreateSubtype('vente'); }}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${createType === 'out' ? 'border-red-500 bg-red-50 text-red-700' : 'border-muted text-muted-foreground hover:border-red-200'}`}
              >
                <ArrowDown className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Sortie</div>
                  <div className="text-xs opacity-70">Consommation de stock</div>
                </div>
              </button>
            </div>

            {/* Product */}
            <div className="space-y-1.5">
              <Label>Produit *</Label>
              <Select value={createProduct} onValueChange={setCreateProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un produit" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span>{p.name}</span>
                      {p.stock !== undefined && (
                        <span className="text-muted-foreground ml-2 text-xs">(Stock actuel : {p.stock})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProduct && createType === 'out' && selectedProduct.stock !== undefined && (
                <div className={`flex items-center gap-1.5 text-xs mt-1 ${Number(selectedProduct.stock) < createQty ? 'text-red-600' : 'text-muted-foreground'}`}>
                  <AlertTriangle className="h-3 w-3" />
                  Stock disponible : <strong>{selectedProduct.stock}</strong>
                  {Number(selectedProduct.stock) < createQty && ' — insuffisant !'}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Quantity */}
              <div className="space-y-1.5">
                <Label>Quantité *</Label>
                <Input
                  type="number"
                  min="1"
                  value={createQty}
                  onChange={e => setCreateQty(Number(e.target.value))}
                />
              </div>

              {/* Subtype */}
              <div className="space-y-1.5">
                <Label>Motif</Label>
                <Select value={createSubtype} onValueChange={setCreateSubtype}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {createType === 'in' ? (
                      <>
                        <SelectItem value="reaprovisonnement">Réapprovisionnement</SelectItem>
                        <SelectItem value="livraison">Livraison</SelectItem>
                        <SelectItem value="retour">Retour client</SelectItem>
                        <SelectItem value="ajustement">Ajustement</SelectItem>
                        <SelectItem value="autre">Autre</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="vente">Vente</SelectItem>
                        <SelectItem value="ajustement">Ajustement</SelectItem>
                        <SelectItem value="autre">Autre</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reference */}
            <div className="space-y-1.5">
              <Label>Référence <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input
                placeholder="N° bon de commande, facture, etc."
                value={createRef}
                onChange={e => setCreateRef(e.target.value)}
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label>Note <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Textarea
                placeholder="Informations complémentaires..."
                value={createNote}
                onChange={e => setCreateNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Annuler</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createProduct || !createQty}
              className={createType === 'out' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {creating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />En cours...</>
              ) : (
                <><Plus className="mr-2 h-4 w-4" />{createType === 'in' ? 'Enregistrer l\'entrée' : 'Enregistrer la sortie'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Stock;
