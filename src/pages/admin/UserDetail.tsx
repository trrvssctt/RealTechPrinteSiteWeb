import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft, RefreshCw, User, Mail, Phone, Shield, ShoppingCart,
  Package, TrendingDown, Activity, Clock, CheckCircle2, XCircle,
  AlertTriangle, Wifi, WifiOff, BarChart3, Edit, Trash2,
  Calendar, Tag, FileText, ChevronRight, Zap, History, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  d ? format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—';

const fmtRel = (d: string) =>
  d ? formatDistanceToNow(new Date(d), { locale: fr, addSuffix: true }) : '—';

const fmtMontant = (v: number | string) =>
  Number(v).toLocaleString('fr-FR') + ' FCFA';

const STATUS_ORDER: Record<string, { label: string; color: string }> = {
  pending:    { label: 'En attente',  color: 'bg-amber-100  text-amber-800  border-amber-200'  },
  processing: { label: 'En cours',    color: 'bg-blue-100   text-blue-800   border-blue-200'   },
  completed:  { label: 'Complétée',   color: 'bg-green-100  text-green-800  border-green-200'  },
  cancelled:  { label: 'Annulée',     color: 'bg-red-100    text-red-800    border-red-200'    },
};

const STATUS_DEP: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'bg-amber-100 text-amber-800'  },
  valide:     { label: 'Validée',    color: 'bg-green-100 text-green-800'  },
  rejete:     { label: 'Rejetée',    color: 'bg-red-100   text-red-800'    },
  annule:     { label: 'Annulée',    color: 'bg-gray-100  text-gray-500'   },
};

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  order_created: <ShoppingCart  className="w-3.5 h-3.5 text-blue-600"    />,
  stock:         <Package       className="w-3.5 h-3.5 text-orange-600"  />,
  depense:       <TrendingDown  className="w-3.5 h-3.5 text-red-500"     />,
  action:        <Zap           className="w-3.5 h-3.5 text-purple-500"  />,
};

// ─── Composant principal ──────────────────────────────────────────────────────

const UserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('7');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Chargement données ─────────────────────────────────────────────────

  const fetchActivity = useCallback(async (showSpinner = false) => {
    if (!id) return;
    if (showSpinner) setRefreshing(true);
    try {
      const r = await apiFetch(`/api/admin/users/${id}/activity?days=${period}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json();
      setData(body);
    } catch (e) {
      // ne pas afficher d'erreur sur les refreshes silencieux
      if (showSpinner) toast.error('Impossible de charger les données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, period]);

  useEffect(() => {
    setLoading(true);
    fetchActivity();
    // Rafraîchissement automatique toutes les 15 s
    intervalRef.current = setInterval(() => fetchActivity(false), 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchActivity]);

  // ─── Actions admin ──────────────────────────────────────────────────────

  const toggleStatus = async () => {
    if (!data?.user) return;
    try {
      const r = await apiFetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !data.user.is_active }),
      });
      if (!r.ok) throw new Error();
      toast.success(`Employé ${data.user.is_active ? 'désactivé' : 'activé'}`);
      setStatusOpen(false);
      fetchActivity(true);
    } catch {
      toast.error('Erreur lors de la modification du statut');
    }
  };

  const deleteUser = async () => {
    if (!data?.user) return;
    try {
      const r = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      toast.success('Employé supprimé (statut = supprimé)');
      navigate('/admin/users');
    } catch {
      toast.error('Impossible de supprimer cet employé');
    } finally {
      setDeleteOpen(false);
    }
  };

  const restoreUser = async () => {
    if (!data?.user) return;
    try {
      const r = await apiFetch(`/api/admin/users/${id}/restore`, { method: 'POST' });
      if (!r.ok) throw new Error();
      toast.success('Compte restauré avec succès');
      fetchActivity(true);
    } catch {
      toast.error('Impossible de restaurer ce compte');
    }
  };

  // ─── Skeleton de chargement ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-80" />
          </div>
        </div>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="p-10 text-center">
        <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">Employé introuvable</h2>
        <Button variant="outline" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const { user, isOnline, lastSeenAt, summary, timeline, ordersCreated, ordersHandled, stockMouvements, depenses, userActions = [] } = data;
  const roles: string[] = user.role_name ? [user.role_name] : [];
  const isActive = user.is_active !== false;
  const isSupprime = user.status === 'supprimé';

  // ─── Rendu ──────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Fiche employé</h1>
            <p className="text-xs text-gray-400 font-mono">{id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Aujourd'hui</SelectItem>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
              <SelectItem value="90">3 mois</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchActivity(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Profil ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              {/* Avatar + statut online */}
              <div className="text-center mb-5">
                <div className="relative inline-block">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto text-white text-2xl font-bold shadow-lg">
                    {(user.full_name || user.name || user.email || '?')[0].toUpperCase()}
                  </div>
                  <span className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mt-3">{user.full_name || user.name || '—'}</h2>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  {isOnline
                    ? <><Wifi className="w-3 h-3 text-green-500" /><span className="text-xs text-green-600 font-medium">En ligne</span></>
                    : <><WifiOff className="w-3 h-3 text-gray-400" /><span className="text-xs text-gray-400">{lastSeenAt ? `Vu ${fmtRel(lastSeenAt)}` : 'Hors ligne'}</span></>
                  }
                </div>
              </div>

              {/* Badges statut + rôle */}
              <div className="flex flex-wrap justify-center gap-2 mb-5">
                {isSupprime ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-gray-100 text-gray-500 border-gray-200">
                    <Trash2 className="w-3 h-3" /> Supprimé
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                    {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {isActive ? 'Actif' : 'Inactif'}
                  </span>
                )}
                {roles.map(r => (
                  <span key={r} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-200">
                    <Shield className="w-3 h-3" />{r}
                  </span>
                ))}
              </div>

              {/* Coordonnées */}
              <div className="space-y-2.5 text-sm">
                {[
                  { icon: Mail,     val: user.email },
                  { icon: Phone,    val: user.phone || '—' },
                  { icon: Calendar, val: user.created_at ? `Depuis le ${format(new Date(user.created_at), 'dd/MM/yyyy')}` : '—' },
                ].map(({ icon: Icon, val }) => (
                  <div key={val} className="flex items-center gap-2 text-gray-600">
                    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate text-xs">{val}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-5 space-y-2">
                {isSupprime ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-green-700 border-green-200 hover:bg-green-50"
                    onClick={restoreUser}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-green-600" /> Restaurer le compte
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setStatusOpen(true)}
                    >
                      {isActive ? <><XCircle className="w-3.5 h-3.5 mr-1.5 text-amber-500" />Désactiver</>
                                : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-500" />Activer</>}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Supprimer
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline 7 derniers jours */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-500" />
                Activité récente
                <span className="ml-auto text-xs font-normal text-gray-400">7 jours</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {timeline.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Aucune activité</p>
              ) : (
                <div className="relative">
                  {/* Ligne verticale */}
                  <div className="absolute left-7 top-0 bottom-0 w-px bg-gray-100" />
                  <div className="space-y-0 max-h-72 overflow-y-auto">
                    {timeline.slice(0, 20).map((item: any, i: number) => (
                      <div key={i} className="flex gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                        <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 z-10 shadow-sm">
                          {TIMELINE_ICONS[item.type] || <Zap className="w-3 h-3 text-gray-400" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 leading-tight">{item.label}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{fmtRel(item.at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Colonne droite ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Cartes de statistiques */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Commandes créées',
                value: summary.ordersCreatedCount,
                icon: <ShoppingCart className="w-5 h-5 text-blue-600" />,
                bg: 'bg-blue-50 border-blue-100',
                text: 'text-blue-700',
              },
              {
                label: 'Commandes traitées',
                value: summary.ordersHandledCount,
                icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
                bg: 'bg-green-50 border-green-100',
                text: 'text-green-700',
              },
              {
                label: 'Mouvements stock',
                value: summary.stockMouvementsCount,
                sub: `${summary.stockSortiesCount} sortie${summary.stockSortiesCount > 1 ? 's' : ''} · ${summary.stockEntreesCount} entrée${summary.stockEntreesCount > 1 ? 's' : ''}`,
                icon: <Package className="w-5 h-5 text-orange-600" />,
                bg: 'bg-orange-50 border-orange-100',
                text: 'text-orange-700',
              },
              {
                label: 'Dépenses déclarées',
                value: summary.depensesCount,
                sub: summary.totalDepensesValide > 0 ? fmtMontant(summary.totalDepensesValide) : undefined,
                icon: <TrendingDown className="w-5 h-5 text-red-600" />,
                bg: 'bg-red-50 border-red-100',
                text: 'text-red-700',
              },
            ].map((s) => (
              <Card key={s.label} className={`border ${s.bg} shadow-none`}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">{s.label}</span>
                    {s.icon}
                  </div>
                  <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
                  {s.sub && <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Onglets détaillés */}
          <Tabs defaultValue="commandes">
            <TabsList className="h-8 text-xs">
              <TabsTrigger value="commandes" className="text-xs px-3">
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                Commandes
                {ordersCreated.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{ordersCreated.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="traitees" className="text-xs px-3">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Traitées
                {ordersHandled.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{ordersHandled.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="stock" className="text-xs px-3">
                <Package className="w-3.5 h-3.5 mr-1.5" />
                Stock
              </TabsTrigger>
              <TabsTrigger value="depenses" className="text-xs px-3">
                <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
                Dépenses
              </TabsTrigger>
              <TabsTrigger value="historique" className="text-xs px-3">
                <History className="w-3.5 h-3.5 mr-1.5" />
                Historique
                {userActions.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{userActions.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* ── Commandes créées ── */}
            <TabsContent value="commandes" className="mt-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-gray-700">Commandes créées par {user.full_name || user.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <OrderTable rows={ordersCreated} empty="Aucune commande créée sur cette période" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Commandes traitées ── */}
            <TabsContent value="traitees" className="mt-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-gray-700">Commandes traitées / modifiées</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <OrderTable rows={ordersHandled} empty="Aucune commande traitée sur cette période" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Mouvements stock ── */}
            <TabsContent value="stock" className="mt-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-gray-700">Mouvements de stock</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {stockMouvements.length === 0 ? (
                    <EmptyState icon={<Package className="w-8 h-8" />} label="Aucun mouvement de stock" />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 text-xs">
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Produit</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs text-right">Qté</TableHead>
                            <TableHead className="text-xs">Référence</TableHead>
                            <TableHead className="text-xs">Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockMouvements.map((s: any) => (
                            <TableRow key={s.id} className="text-xs hover:bg-gray-50">
                              <TableCell className="text-gray-500 whitespace-nowrap">{fmtDate(s.created_at)}</TableCell>
                              <TableCell className="font-medium max-w-[140px] truncate">{s.product_name || '—'}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${s.movement_type === 'out' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                  {s.movement_type === 'out' ? '↓ Sortie' : '↑ Entrée'}
                                  {s.movement_subtype && ` · ${s.movement_subtype}`}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold">{s.quantity}</TableCell>
                              <TableCell className="text-gray-400 text-[10px]">{s.reference || '—'}</TableCell>
                              <TableCell>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.status === 'voided' ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-700'}`}>
                                  {s.status === 'voided' ? 'Annulé' : 'Actif'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Dépenses ── */}
            <TabsContent value="depenses" className="mt-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-gray-700">Dépenses déclarées</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {depenses.length === 0 ? (
                    <EmptyState icon={<TrendingDown className="w-8 h-8" />} label="Aucune dépense déclarée" />
                  ) : (
                    <>
                      {/* Résumé rapide */}
                      <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 border-b text-center text-xs">
                        {(['en_attente', 'valide', 'rejete'] as const).map(st => {
                          const items = depenses.filter((d: any) => d.statut === st);
                          const total = items.reduce((s: number, d: any) => s + parseFloat(d.montant || 0), 0);
                          const cfg = STATUS_DEP[st];
                          return (
                            <div key={st}>
                              <p className="text-gray-400 mb-0.5">{cfg.label}</p>
                              <p className="font-bold text-gray-800">{items.length}</p>
                              <p className={`text-[10px] ${cfg.color} rounded px-1 inline-block`}>{fmtMontant(total)}</p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 text-xs">
                              <TableHead className="text-xs">Date</TableHead>
                              <TableHead className="text-xs">Description</TableHead>
                              <TableHead className="text-xs">Catégorie</TableHead>
                              <TableHead className="text-xs text-right">Montant</TableHead>
                              <TableHead className="text-xs">Statut</TableHead>
                              <TableHead className="text-xs">Validé le</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {depenses.map((d: any) => (
                              <TableRow key={d.id} className="text-xs hover:bg-gray-50">
                                <TableCell className="text-gray-500 whitespace-nowrap">{fmtDate(d.created_at)}</TableCell>
                                <TableCell className="max-w-[150px] truncate font-medium" title={d.description}>{d.description}</TableCell>
                                <TableCell>
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                    <Tag className="w-2.5 h-2.5" />{d.categorie}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-bold">{fmtMontant(d.montant)}</TableCell>
                                <TableCell>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_DEP[d.statut]?.color || ''}`}>
                                    {STATUS_DEP[d.statut]?.label || d.statut}
                                  </span>
                                </TableCell>
                                <TableCell className="text-gray-400 text-[10px]">
                                  {d.validated_at ? <>{fmtRel(d.validated_at)}<br/><span className="text-gray-300">{d.validateur_name}</span></> : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            {/* ── Historique des actions ── */}
            <TabsContent value="historique" className="mt-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                    <History className="w-4 h-4 text-purple-500" />
                    Journal des actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {userActions.length === 0 ? (
                    <EmptyState icon={<History className="w-8 h-8" />} label="Aucune action enregistrée" />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 text-xs">
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Action</TableHead>
                            <TableHead className="text-xs">Détails</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userActions.map((a: any, i: number) => {
                            const actionColors: Record<string, string> = {
                              create_user:  'bg-green-100 text-green-700',
                              update_user:  'bg-blue-100 text-blue-700',
                              delete_user:  'bg-red-100 text-red-700',
                              restore_user: 'bg-purple-100 text-purple-700',
                            };
                            const color = actionColors[a.action] || 'bg-gray-100 text-gray-600';
                            const meta = typeof a.metadata === 'string' ? JSON.parse(a.metadata || '{}') : (a.metadata || {});
                            return (
                              <TableRow key={i} className="text-xs hover:bg-gray-50">
                                <TableCell className="text-gray-500 whitespace-nowrap">{fmtDate(a.created_at)}</TableCell>
                                <TableCell>
                                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-medium ${color}`}>
                                    {a.action}
                                  </span>
                                </TableCell>
                                <TableCell className="text-gray-400 text-[10px] max-w-xs">
                                  {meta.changes && Object.keys(meta.changes).length > 0
                                    ? Object.entries(meta.changes).map(([k, v]: any) => (
                                        <span key={k} className="mr-2">
                                          <span className="font-medium text-gray-600">{k}:</span>{' '}
                                          {typeof v === 'object' ? `${v.old ?? '—'} → ${v.new ?? '—'}` : String(v)}
                                        </span>
                                      ))
                                    : meta.email || meta.deleted_by
                                      ? JSON.stringify(meta).substring(0, 80)
                                      : '—'
                                  }
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Dialog : Changer statut ──────────────────────────────────── */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isActive ? <XCircle className="w-5 h-5 text-amber-500" /> : <CheckCircle2 className="w-5 h-5 text-green-500" />}
              {isActive ? 'Désactiver' : 'Activer'} l'employé
            </DialogTitle>
            <DialogDescription>
              {isActive
                ? `${user.full_name || user.email} ne pourra plus se connecter.`
                : `${user.full_name || user.email} pourra à nouveau se connecter.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Annuler</Button>
            <Button onClick={toggleStatus} className={isActive ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : Supprimer ───────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" /> Supprimer l'employé
            </DialogTitle>
            <DialogDescription>
              Le compte de <strong>{user.full_name || user.email}</strong> sera marqué comme <strong>supprimé</strong> (statut = supprimé, connexion bloquée). L'historique et toutes les données sont conservés. Un administrateur peut restaurer le compte.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={deleteUser}>
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

const OrderTable = ({ rows, empty }: { rows: any[]; empty: string }) => {
  if (rows.length === 0) return <EmptyState icon={<ShoppingCart className="w-8 h-8" />} label={empty} />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Client</TableHead>
            <TableHead className="text-xs text-right">Montant</TableHead>
            <TableHead className="text-xs">Statut</TableHead>
            <TableHead className="text-xs">Articles</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o: any) => {
            const cfg = STATUS_ORDER[o.status] || { label: o.status, color: 'bg-gray-100 text-gray-500' };
            return (
              <TableRow key={o.id} className="text-xs hover:bg-gray-50">
                <TableCell className="text-gray-500 whitespace-nowrap">{o.placed_at ? format(new Date(o.placed_at), 'dd/MM/yy HH:mm') : '—'}</TableCell>
                <TableCell className="font-medium max-w-[120px] truncate">{o.client_name || '—'}</TableCell>
                <TableCell className="text-right font-bold">{Number(o.total_amount || 0).toLocaleString('fr-FR')} FCFA</TableCell>
                <TableCell>
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>
                </TableCell>
                <TableCell className="text-gray-400">{o.nb_items ?? '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

const EmptyState = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="text-center py-12 text-gray-300">
    <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
      {icon}
    </div>
    <p className="text-sm text-gray-400">{label}</p>
  </div>
);

export default UserDetail;
