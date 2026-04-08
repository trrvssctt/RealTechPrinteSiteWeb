import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft, RefreshCw, User, Mail, Phone, ShoppingCart,
  TrendingUp, TrendingDown, Package, CheckCircle2, XCircle,
  Clock, Trophy, Star, BarChart3, ChevronDown, ChevronUp,
  Edit, Trash2, AlertTriangle, Calendar, Minus,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate  = (d: string) => d ? format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—';
const fmtShort = (d: string) => d ? format(new Date(d), 'dd/MM/yy',          { locale: fr }) : '—';
const fmtRel   = (d: string) => d ? formatDistanceToNow(new Date(d), { locale: fr, addSuffix: true }) : '—';
const fmtCfa   = (v: number | string) =>
  Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' FCFA';

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: 'En attente',  color: 'bg-amber-100  text-amber-800  border-amber-200',  icon: <Clock        className="w-3 h-3" /> },
  processing: { label: 'En cours',    color: 'bg-blue-100   text-blue-800   border-blue-200',   icon: <RefreshCw    className="w-3 h-3" /> },
  completed:  { label: 'Complétée',   color: 'bg-green-100  text-green-800  border-green-200',  icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled:  { label: 'Annulée',     color: 'bg-red-100    text-red-800    border-red-200',    icon: <XCircle      className="w-3 h-3" /> },
};

const VIP_THRESHOLD_RANK = 3;   // top 3 = VIP
const GOOD_RANK = 10;            // top 10 = bon client

// ─── Composant ────────────────────────────────────────────────────────────────

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [editOpen, setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm]   = useState({ full_name: '', email: '', phone: '' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Chargement ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async (showSpinner = false) => {
    if (!id) return;
    if (showSpinner) setRefreshing(true);
    try {
      const r = await apiFetch(`/api/admin/clients/${id}/stats`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json();
      setData(body);
      setEditForm({
        full_name: body.client?.full_name || '',
        email:     body.client?.email     || '',
        phone:     body.client?.phone     || '',
      });
    } catch {
      if (showSpinner) toast.error('Impossible de charger les données client');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    intervalRef.current = setInterval(() => fetchData(false), 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleEdit = async () => {
    try {
      const r = await apiFetch(`/api/admin/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!r.ok) throw new Error();
      toast.success('Client mis à jour');
      setEditOpen(false);
      fetchData(true);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async () => {
    try {
      const r = await apiFetch(`/api/admin/clients/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || 'Erreur');
      }
      toast.success('Client désactivé');
      navigate('/admin/clients');
    } catch (e: any) {
      toast.error(e.message === 'client has pending orders'
        ? 'Ce client a des commandes en attente — impossible de le supprimer'
        : 'Erreur lors de la suppression');
    } finally {
      setDeleteOpen(false);
    }
  };

  // ─── États de chargement / erreur ────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!data?.client) {
    return (
      <div className="p-10 text-center">
        <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">Client introuvable</h2>
        <Button variant="outline" onClick={() => navigate('/admin/clients')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Retour
        </Button>
      </div>
    );
  }

  const { client, rank, summary, orders, topProducts, monthly } = data;
  const isVip  = rank && rank <= VIP_THRESHOLD_RANK;
  const isGood = rank && rank <= GOOD_RANK;

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/clients')}>
            <ArrowLeft className="w-4 h-4 mr-1" />Retour
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{client.full_name || '—'}</h1>
              {isVip  && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200"><Trophy className="w-3 h-3" /> VIP</span>}
              {!isVip && isGood && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200"><Star className="w-3 h-3" /> Fidèle</span>}
            </div>
            <p className="text-xs text-gray-400">Client depuis {client.created_at ? fmtRel(client.created_at) : '—'}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="w-4 h-4 mr-1.5" />Modifier
          </Button>
          <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Profil ─────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-5 pb-4">

              {/* Avatar + rang */}
              <div className="text-center mb-5">
                <div className="relative inline-block">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white text-2xl font-bold shadow-lg ${isVip ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                    {(client.full_name || client.email || '?')[0].toUpperCase()}
                  </div>
                  {rank && (
                    <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow ${isVip ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-100 text-gray-600'}`}>
                      #{rank}
                    </div>
                  )}
                </div>
                <h2 className="text-base font-bold text-gray-800 mt-3">{client.full_name || '—'}</h2>
                {rank && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isVip ? '🏆 Top 3 clients' : isGood ? '⭐ Top 10 clients' : `Rang #${rank}`}
                  </p>
                )}
              </div>

              {/* Coordonnées */}
              <div className="space-y-2 text-sm">
                {[
                  { icon: Mail,     val: client.email || '—' },
                  { icon: Phone,    val: client.phone || '—' },
                  { icon: Calendar, val: client.created_at ? `Depuis le ${format(new Date(client.created_at), 'dd/MM/yyyy')}` : '—' },
                ].map(({ icon: Icon, val }) => (
                  <div key={val} className="flex items-center gap-2 text-gray-600">
                    <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs truncate">{val}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top produits */}
          {topProducts?.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-500" />
                  Produits favoris
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2.5">
                  {topProducts.map((p: any, i: number) => (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400">{p.nb_orders} cmd · ×{p.total_qty}</p>
                      </div>
                      <span className="text-xs font-bold text-primary whitespace-nowrap">
                        {fmtCfa(p.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Évolution mensuelle */}
          {monthly?.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  Évolution (12 mois)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1.5">
                  {(() => {
                    const maxRev = Math.max(...monthly.map((m: any) => parseFloat(m.revenue)));
                    return monthly.slice(-6).map((m: any) => {
                      const rev = parseFloat(m.revenue);
                      const pct = maxRev > 0 ? (rev / maxRev) * 100 : 0;
                      const [y, mo] = m.month.split('-');
                      const label = format(new Date(Number(y), Number(mo) - 1, 1), 'MMM', { locale: fr });
                      return (
                        <div key={m.month} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-8 text-right capitalize">{label}</span>
                          <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-primary/70 rounded transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 w-20 text-right whitespace-nowrap">
                            {rev > 0 ? fmtCfa(rev) : '—'}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Colonne droite ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'CA total',
                value: fmtCfa(summary.totalSpent),
                icon: <TrendingUp className="w-5 h-5 text-green-600" />,
                bg: 'bg-green-50 border-green-100',
                text: 'text-green-700',
              },
              {
                label: 'Commandes',
                value: summary.totalOrders,
                sub: `${summary.completedCount} complétées`,
                icon: <ShoppingCart className="w-5 h-5 text-blue-600" />,
                bg: 'bg-blue-50 border-blue-100',
                text: 'text-blue-700',
              },
              {
                label: 'Panier moyen',
                value: fmtCfa(summary.avgOrder),
                icon: <Package className="w-5 h-5 text-purple-600" />,
                bg: 'bg-purple-50 border-purple-100',
                text: 'text-purple-700',
              },
              {
                label: 'Ce mois',
                value: fmtCfa(summary.thisMonthRevenue),
                sub: (() => {
                  const g = summary.growth;
                  if (!summary.lastMonthRevenue) return null;
                  return g >= 0
                    ? `+${g.toFixed(0)}% vs mois dernier`
                    : `${g.toFixed(0)}% vs mois dernier`;
                })(),
                subColor: summary.growth >= 0 ? 'text-green-600' : 'text-red-500',
                icon: summary.growth >= 0
                  ? <TrendingUp   className="w-5 h-5 text-orange-500" />
                  : <TrendingDown className="w-5 h-5 text-red-500" />,
                bg: 'bg-orange-50 border-orange-100',
                text: 'text-orange-700',
              },
            ].map((s) => (
              <Card key={s.label} className={`border ${s.bg} shadow-none`}>
                <CardContent className="pt-3 pb-3 px-4">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">{s.label}</span>
                    {s.icon}
                  </div>
                  <p className={`text-base font-bold leading-tight ${s.text}`}>{s.value}</p>
                  {s.sub && <p className={`text-[10px] mt-0.5 ${(s as any).subColor || 'text-gray-400'}`}>{s.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Barre récapitulative statuts */}
          <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3 shadow-sm text-xs">
            {[
              { key: 'completedCount', label: 'Complétées', color: 'bg-green-500' },
              { key: 'pendingCount',   label: 'En attente', color: 'bg-amber-400' },
              { key: 'cancelledCount', label: 'Annulées',   color: 'bg-red-400'   },
            ].map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-gray-500">{label}</span>
                <span className="font-bold text-gray-800">{summary[key]}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-gray-400">Taux de complétion</span>
              <span className="font-bold text-gray-800">
                {summary.totalOrders > 0 ? Math.round((summary.completedCount / summary.totalOrders) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Historique des commandes */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-500" />
                Historique des commandes
                <Badge variant="secondary" className="ml-auto text-[10px]">{orders.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="text-center py-10 text-gray-300">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Aucune commande</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {orders.map((o: any) => {
                    const cfg = STATUS_CFG[o.status] || { label: o.status, color: 'bg-gray-100 text-gray-500 border-gray-200', icon: <Minus className="w-3 h-3" /> };
                    const expanded = expandedOrder === o.id;
                    const items: any[] = o.items || [];

                    return (
                      <div key={o.id} className="hover:bg-gray-50 transition-colors">
                        {/* Ligne principale */}
                        <button
                          className="w-full text-left px-4 py-3 flex items-center gap-3"
                          onClick={() => setExpandedOrder(expanded ? null : o.id)}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${cfg.color}`}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-800">{fmtShort(o.placed_at)}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>
                              {o.traite_par && <span className="text-[10px] text-gray-400 hidden sm:inline">par {o.traite_par}</span>}
                            </div>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{o.id.slice(0, 8).toUpperCase()}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-bold text-gray-900">{fmtCfa(o.total_amount)}</span>
                            {items.length > 0 && (
                              expanded
                                ? <ChevronUp   className="w-4 h-4 text-gray-400" />
                                : <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Détail articles (accordéon) */}
                        {expanded && items.length > 0 && (
                          <div className="px-4 pb-3 bg-gray-50/60">
                            <div className="border border-gray-100 rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-100">
                                    <TableHead className="text-[10px] py-1.5">Produit / Service</TableHead>
                                    <TableHead className="text-[10px] py-1.5 text-right">Qté</TableHead>
                                    <TableHead className="text-[10px] py-1.5 text-right">P.U.</TableHead>
                                    <TableHead className="text-[10px] py-1.5 text-right">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((item: any, i: number) => (
                                    <TableRow key={i} className="text-[10px]">
                                      <TableCell className="py-1.5 font-medium">{item.name}</TableCell>
                                      <TableCell className="py-1.5 text-right text-gray-600">{item.qty}</TableCell>
                                      <TableCell className="py-1.5 text-right text-gray-600">{fmtCfa(item.unit_price)}</TableCell>
                                      <TableCell className="py-1.5 text-right font-bold">{fmtCfa(item.total)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            {o.cancel_reason && (
                              <p className="text-[10px] text-red-500 mt-1.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />Motif annulation : {o.cancel_reason}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Dialog modifier ──────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-4 h-4" /> Modifier le client
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { id: 'fn',  label: 'Nom complet', field: 'full_name', type: 'text' },
              { id: 'em',  label: 'Email',        field: 'email',     type: 'email' },
              { id: 'ph',  label: 'Téléphone',    field: 'phone',     type: 'tel' },
            ].map(({ id: fid, label, field, type }) => (
              <div key={fid}>
                <Label htmlFor={fid} className="text-sm">{label}</Label>
                <Input
                  id={fid}
                  type={type}
                  className="mt-1"
                  value={(editForm as any)[field]}
                  onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog supprimer ─────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" /> Désactiver le client
            </DialogTitle>
            <DialogDescription>
              Le client <strong>{client.full_name}</strong> sera désactivé.
              Ses commandes passées restent conservées. Impossible si des commandes sont en attente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDetail;
