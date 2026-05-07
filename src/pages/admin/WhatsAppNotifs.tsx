import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Package,
  FileText,
  TrendingDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface Notification {
  id: string;
  event_type: string;
  event_id: string | null;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  error_message: string | null;
  metadata: any;
  created_at: string;
}

const EVENT_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  sale_completed:  { label: 'Vente complétée',    icon: ShoppingCart, color: 'text-emerald-600 bg-emerald-50' },
  order_created:   { label: 'Nouvelle commande',   icon: ShoppingCart, color: 'text-blue-600 bg-blue-50' },
  order_cancelled: { label: 'Commande annulée',    icon: TrendingDown, color: 'text-rose-600 bg-rose-50' },
  stock_exit:      { label: 'Sortie stock',         icon: Package,      color: 'text-orange-600 bg-orange-50' },
  stock_entry:     { label: 'Entrée stock',        icon: Package,      color: 'text-green-600 bg-green-50' },
  daily_report:    { label: 'Rapport journalier',  icon: FileText,     color: 'text-purple-600 bg-purple-50' },
};

const STATUS_CONFIG = {
  sent:    { label: 'Envoyé',     icon: CheckCircle2, className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  failed:  { label: 'Échoué',    icon: XCircle,      className: 'text-rose-700 bg-rose-50 border-rose-200' },
  pending: { label: 'En attente', icon: Clock,        className: 'text-amber-700 bg-amber-50 border-amber-200' },
};

export default function WhatsAppNotifs() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType]   = useState<string>('all');
  const [page, setPage] = useState(0);

  const token = localStorage.getItem('sessionToken') || '';
  const headers = { Authorization: `Bearer ${token}` };
  const LIMIT = 25;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit:  String(LIMIT),
        offset: String(page * LIMIT),
      });
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterType !== 'all')   params.set('type', filterType);

      const resp = await apiFetch(`/api/admin/agent/notifications?${params}`, { headers });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const { data, total: t } = await resp.json();
      setNotifications(data || []);
      setTotal(t || 0);
    } catch (e) {
      toast.error('Erreur chargement notifications');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, page]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  async function retry(id: string) {
    setRetrying(id);
    try {
      const resp = await apiFetch(`/api/admin/agent/notifications/${id}/retry`, {
        method: 'POST',
        headers,
      });
      if (resp.ok) {
        toast.success('Notification renvoyée avec succès');
        loadNotifications();
      } else {
        const { error } = await resp.json().catch(() => ({ error: 'Erreur inconnue' }));
        toast.error(error || 'Échec du renvoi');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setRetrying(null);
    }
  }

  // Statistiques rapides
  const stats = {
    sent:    notifications.filter(n => n.status === 'sent').length,
    failed:  notifications.filter(n => n.status === 'failed').length,
    pending: notifications.filter(n => n.status === 'pending').length,
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-emerald-600" />
          Notifications WhatsApp
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Journal de toutes les notifications envoyées à l'administrateur via WhatsApp.
        </p>
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold text-emerald-700">{stats.sent}</p>
              <p className="text-xs text-emerald-600">Envoyés</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-rose-600" />
            <div>
              <p className="text-2xl font-bold text-rose-700">{stats.failed}</p>
              <p className="text-xs text-rose-600">Échoués</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
              <p className="text-xs text-amber-600">En attente</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="sent">Envoyés</SelectItem>
              <SelectItem value="failed">Échoués</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Type d'événement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="sale_completed">Ventes</SelectItem>
              <SelectItem value="order_created">Commandes</SelectItem>
              <SelectItem value="order_cancelled">Annulations</SelectItem>
              <SelectItem value="stock_exit">Sorties stock</SelectItem>
              <SelectItem value="daily_report">Rapports</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={loadNotifications}
            className="ml-auto gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-800">
            {total} notification{total > 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <MessageSquare className="h-10 w-10 mb-2" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-40">Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-28">Statut</TableHead>
                  <TableHead className="w-36">Date</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map(notif => {
                  const evt = EVENT_CONFIG[notif.event_type] || { label: notif.event_type, icon: AlertCircle, color: 'text-gray-600 bg-gray-50' };
                  const EvtIcon = evt.icon;
                  const st  = STATUS_CONFIG[notif.status] || STATUS_CONFIG.pending;
                  const StIcon = st.icon;

                  return (
                    <TableRow key={notif.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${evt.color}`}>
                          <EvtIcon className="h-3.5 w-3.5" />
                          <span>{evt.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-gray-700 line-clamp-2 whitespace-pre-line">
                          {notif.message}
                        </p>
                        {notif.error_message && (
                          <p className="text-xs text-rose-500 mt-1 truncate">{notif.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs gap-1 ${st.className}`} variant="outline">
                          <StIcon className="h-3 w-3" />
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {new Date(notif.created_at).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {notif.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => retry(notif.id)}
                            disabled={retrying === notif.id}
                          >
                            {retrying === notif.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <RotateCcw className="h-3.5 w-3.5" />
                            }
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">
              {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} sur {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * LIMIT >= total}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
