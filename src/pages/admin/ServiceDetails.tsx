import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { 
  ArrowLeft, Edit, Trash2, Calendar, Clock, DollarSign,
  Users, Tag, CheckCircle, XCircle, Star, Shield,
  BarChart3, Settings, Zap, FileText, Activity,
  Share2, Copy, Download, Printer, Mail,
  MoreVertical, TrendingUp, Eye, ShoppingCart
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ServiceStats {
  totalOrders: number;
  totalQty: number;
  revenue: number;
  revenueCompleted: number;
  avgUnitPrice: number;
  margin: number | null;
  distinctClients: number;
  completionRate: number;
  cancelledOrders: number;
  firstSaleAt: string | null;
  lastSaleAt: string | null;
  monthly: Array<{ month: string; qty: number; revenue: number; orders: number }>;
  topClients: Array<{ client_id: string | null; name: string; qty: number; revenue: number }>;
  lines: Array<{ order_id: string; placed_at: string; status: string; client_id: string | null; client_name: string | null; quantity: number; unit_price: number; total: number }>;
}

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'En cours', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Terminée', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Annulée', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_FR[m - 1]} ${String(y).slice(2)}`;
};

const ServiceDetailsImproved = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  // Statistiques réelles, calculées côté serveur à partir des commandes contenant ce service
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const categories = [
    { value: 'general', label: 'Général', icon: Tag, color: 'bg-blue-100 text-blue-800' },
    { value: 'premium', label: 'Premium', icon: Star, color: 'bg-yellow-100 text-yellow-800' },
    { value: 'training', label: 'Formation', icon: Users, color: 'bg-purple-100 text-purple-800' },
    { value: 'consulting', label: 'Consulting', icon: BarChart3, color: 'bg-green-100 text-green-800' },
    { value: 'maintenance', label: 'Maintenance', icon: Settings, color: 'bg-orange-100 text-orange-800' },
    { value: 'support', label: 'Support', icon: Shield, color: 'bg-red-100 text-red-800' }
  ];

  useEffect(() => {
    if (id) {
      fetchServiceDetails(id);
      fetchServiceStats(id);
    }
  }, [id]);

  const fetchServiceDetails = async (serviceId: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/services/${serviceId}`);
      if (!res.ok) throw new Error('Échec du chargement');
      const data = await res.json();
      setService(data.data || null);
    } catch (e) {
      console.error(e);
      toast.error('Impossible de charger les détails du service');
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceStats = async (serviceId: string) => {
    setStatsLoading(true);
    try {
      const resp = await apiFetch(`/api/admin/services/${serviceId}/stats`);
      if (!resp.ok) throw new Error(`Erreur ${resp.status}`);
      const body = await resp.json();
      setStats(body.data || null);
    } catch (e) {
      console.error('Erreur chargement stats:', e);
      setStats(null);
      toast.error('Statistiques du service indisponibles');
    } finally {
      setStatsLoading(false);
    }
  };

  const toggleServiceStatus = async () => {
    if (!service) return;
    
    try {
      const newStatus = !service.is_active;
      const res = await apiFetch(`/api/admin/services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus })
      });
      
      if (!res.ok) throw new Error('Échec de la mise à jour');
      
      setService({ ...service, is_active: newStatus });
      toast.success(`Service ${newStatus ? 'activé' : 'désactivé'}`);
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors du changement de statut');
    }
  };

  const deleteService = async () => {
    if (!service) return;
    
    try {
      const res = await apiFetch(`/api/admin/services/${service.id}`, { 
        method: 'DELETE' 
      });
      
      if (!res.ok) throw new Error('Échec de la suppression');
      
      toast.success('Service supprimé avec succès');
      navigate('/admin/services');
    } catch (e) { 
      console.error(e); 
      toast.error('Impossible de supprimer le service');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount).replace('XOF', 'F CFA');
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
    }
    return `${mins}min`;
  };

  const getCategoryInfo = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat || categories[0];
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papier');
  };

  const exportServiceDetails = () => {
    const details = `
Service: ${service?.name}
Description: ${service?.description || 'Non renseignée'}
Prix: ${formatCurrency(service?.price || 0)}
Durée: ${formatDuration(service?.duration_minutes || 0)}
Catégorie: ${getCategoryInfo(service?.category || 'general').label}
Statut: ${service?.is_active ? 'Actif' : 'Inactif'}
Identifiant: ${service?.id}
    `.trim();

    const blob = new Blob([details], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service_${service?.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Détails exportés');
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.icon || Tag;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="p-6 text-center py-12">
        <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <XCircle className="h-6 w-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Service non trouvé
        </h3>
        <p className="text-gray-600 max-w-sm mx-auto mb-6">
          Le service que vous recherchez n'existe pas ou a été supprimé.
        </p>
        <Button onClick={() => navigate('/admin/services')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux services
        </Button>
      </div>
    );
  }

  const categoryInfo = getCategoryInfo(service.category || 'general');
  const CategoryIcon = getCategoryIcon(service.category || 'general');

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/services')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {service.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={categoryInfo.color}>
                <CategoryIcon className="h-3 w-3 mr-1" />
                {categoryInfo.label}
              </Badge>
              <Badge variant={service.is_active ? "success" : "secondary"}>
                {service.is_active ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Actif
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Inactif
                  </>
                )}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="h-4 w-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions du service</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setOpenEditDialog(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleServiceStatus}>
                {service.is_active ? (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Désactiver
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Activer
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportServiceDetails}>
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyToClipboard(service.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Copier l'ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600"
                onClick={() => setOpenDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            onClick={() => setOpenEditDialog(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Edit className="h-4 w-4" />
            Éditer
          </Button>
        </div>
      </div>

      {/* Quick Stats — données réelles (commandes contenant ce service) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Commandes</p>
                {statsLoading
                  ? <Skeleton className="h-8 w-24 mt-2" />
                  : <h3 className="text-2xl font-bold mt-2">{stats ? stats.totalOrders : '—'}</h3>}
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{stats ? `${stats.totalQty} unité(s) vendue(s)` : 'Commandes non annulées'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Chiffre d'affaires</p>
                {statsLoading
                  ? <Skeleton className="h-8 w-24 mt-2" />
                  : <h3 className="text-2xl font-bold mt-2">{stats ? formatCurrency(stats.revenue) : '—'}</h3>}
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{stats ? `dont ${formatCurrency(stats.revenueCompleted)} sur commandes terminées` : 'Hors commandes annulées'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Clients</p>
                {statsLoading
                  ? <Skeleton className="h-8 w-24 mt-2" />
                  : <h3 className="text-2xl font-bold mt-2">{stats ? stats.distinctClients : '—'}</h3>}
              </div>
              <div className="p-3 bg-indigo-50 rounded-full">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{stats && stats.totalQty > 0 ? `Prix moyen pratiqué : ${formatCurrency(stats.avgUnitPrice)}` : 'Clients distincts'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taux de complétion</p>
                {statsLoading
                  ? <Skeleton className="h-8 w-24 mt-2" />
                  : <h3 className="text-2xl font-bold mt-2">{stats ? `${stats.completionRate}%` : '—'}</h3>}
              </div>
              <div className="p-3 bg-purple-50 rounded-full">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{stats ? `${stats.cancelledOrders} commande(s) annulée(s)` : 'Commandes terminées'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-auto grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50">
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="details" className="data-[state=active]:bg-blue-50">
            Détails
          </TabsTrigger>
          <TabsTrigger value="statistics" className="data-[state=active]:bg-blue-50">
            Statistiques
          </TabsTrigger>
          <TabsTrigger value="bookings" className="data-[state=active]:bg-blue-50">
            Commandes
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Service Information Card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Informations du service
                </CardTitle>
                <CardDescription>
                  Détails et spécifications du service
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Prix</Label>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="text-2xl font-bold">
                        {formatCurrency(service.price || 0)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Durée</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <span className="text-2xl font-bold">
                        {formatDuration(service.duration_minutes || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Description</Label>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    {service.description ? (
                      <p className="text-gray-700 whitespace-pre-line">
                        {service.description}
                      </p>
                    ) : (
                      <p className="text-gray-500 italic">
                        Aucune description fournie
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Catégorie</Label>
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="h-4 w-4" />
                      <span>{categoryInfo.label}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Statut</Label>
                    <div>
                      <Badge variant={service.is_active ? "success" : "secondary"}>
                        {service.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">ID</Label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {service.id.slice(0, 8)}...
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(service.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Métadonnées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Date de création</span>
                    <span className="text-sm font-medium">
                      {new Date(service.created_at || Date.now()).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Dernière mise à jour</span>
                    <span className="text-sm font-medium">
                      {new Date(service.updated_at || Date.now()).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  
                  {service.requires_approval !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Approbation requise</span>
                      <Badge variant={service.requires_approval ? "outline" : "secondary"}>
                        {service.requires_approval ? 'Oui' : 'Non'}
                      </Badge>
                    </div>
                  )}
                  
                  {service.max_participants && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Participants max</span>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">{service.max_participants}</span>
                      </div>
                    </div>
                  )}
                  
                  {service.color_code && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Couleur</span>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: service.color_code }}
                        />
                        <code className="text-xs">{service.color_code}</code>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={exportServiceDetails}
                >
                  <Download className="h-4 w-4" />
                  Exporter les détails
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* Details Tab — tarification et marge */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Tarification</CardTitle>
              <CardDescription>Prix catalogue, prix d'achat et prix réellement pratiqués</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const price = Number(service.price || 0);
                const cost = Number(service.purchase_price || 0);
                const rows: Array<[string, React.ReactNode]> = [
                  ['Prix de vente (catalogue)', formatCurrency(price)],
                  ["Prix d'achat", cost > 0 ? formatCurrency(cost) : <span className="text-gray-400">Non renseigné</span>],
                  ['Marge unitaire (catalogue)', cost > 0 && price > 0
                    ? `${formatCurrency(price - cost)} (${Math.round(((price - cost) / price) * 100)}%)`
                    : <span className="text-gray-400">—</span>],
                  ['Prix moyen réellement pratiqué', stats && stats.totalQty > 0 ? formatCurrency(stats.avgUnitPrice) : <span className="text-gray-400">Aucune vente</span>],
                  ['Marge réalisée', stats?.margin != null ? formatCurrency(stats.margin) : <span className="text-gray-400">Prix d'achat inconnu sur les ventes</span>],
                  ['Première vente', stats?.firstSaleAt ? new Date(stats.firstSaleAt).toLocaleDateString('fr-FR') : '—'],
                  ['Dernière vente', stats?.lastSaleAt ? new Date(stats.lastSaleAt).toLocaleDateString('fr-FR') : '—'],
                ];
                return (
                  <div className="divide-y">
                    {rows.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between py-3 text-sm">
                        <span className="text-gray-600">{label}</span>
                        <span className="font-medium text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab — 12 derniers mois */}
        <TabsContent value="statistics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Chiffre d'affaires mensuel</CardTitle>
              <CardDescription>12 derniers mois, hors commandes annulées</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-64 w-full" /> : !stats || stats.totalQty === 0 ? (
                <p className="text-center py-10 text-sm text-gray-500">Ce service n'a pas encore été vendu.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthly.map(m => ({ ...m, label: monthLabel(m.month) }))} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <YAxis tickLine={false} axisLine={false} width={70} tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={(v) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v)} />
                      <Tooltip
                        cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                        formatter={(value: any, _name: any, item: any) => [
                          `${formatCurrency(Number(value))} · ${item?.payload?.qty ?? 0} unité(s)`, "Chiffre d'affaires",
                        ]}
                        labelStyle={{ color: '#111827', fontWeight: 600 }}
                      />
                      <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meilleurs clients</CardTitle>
              <CardDescription>Par chiffre d'affaires sur ce service</CardDescription>
            </CardHeader>
            <CardContent>
              {!stats || stats.topClients.length === 0 ? (
                <p className="text-center py-6 text-sm text-gray-500">Aucun client pour l'instant.</p>
              ) : (
                <div className="divide-y">
                  {stats.topClients.map((c, i) => (
                    <div key={c.client_id || c.name} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-5 text-gray-400">{i + 1}.</span>
                        {c.client_id
                          ? <button className="font-medium text-blue-700 hover:underline" onClick={() => navigate(`/admin/clients/${c.client_id}`)}>{c.name}</button>
                          : <span className="font-medium">{c.name}</span>}
                        <span className="text-gray-400">· {c.qty} unité(s)</span>
                      </span>
                      <span className="font-semibold">{formatCurrency(c.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commandes contenant ce service */}
        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>Commandes</CardTitle>
              <CardDescription>Toutes les commandes contenant ce service (200 plus récentes)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {statsLoading ? <div className="p-6"><Skeleton className="h-40 w-full" /></div> : !stats || stats.lines.length === 0 ? (
                <p className="text-center py-10 text-sm text-gray-500">Aucune commande ne contient ce service.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Commande</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Qté</TableHead>
                        <TableHead className="text-right">Prix unitaire</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.lines.map((l, i) => {
                        const st = ORDER_STATUS[l.status] || { label: l.status, className: 'bg-gray-50 text-gray-600 border-gray-200' };
                        return (
                          <TableRow key={`${l.order_id}-${i}`} className={l.status === 'cancelled' ? 'opacity-60' : ''}>
                            <TableCell className="whitespace-nowrap">{new Date(l.placed_at).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell className="font-mono text-xs">CMD-{l.order_id.slice(0, 8).toUpperCase()}</TableCell>
                            <TableCell>
                              {l.client_id
                                ? <button className="text-blue-700 hover:underline" onClick={() => navigate(`/admin/clients/${l.client_id}`)}>{l.client_name || 'Client'}</button>
                                : (l.client_name || '—')}
                            </TableCell>
                            <TableCell className="text-right">{l.quantity}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(l.unit_price)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap font-medium">{formatCurrency(l.total)}</TableCell>
                            <TableCell><Badge variant="outline" className={st.className}>{st.label}</Badge></TableCell>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le service</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement le service "
              <span className="font-semibold">{service.name}</span>".
              
              <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 text-red-700 font-medium">
                  <Trash2 className="h-4 w-4" />
                  Attention : Cette action est irréversible
                </div>
                <ul className="mt-2 text-sm text-red-600 space-y-1">
                  <li>• Toutes les données associées seront perdues</li>
                  <li>• Les réservations futures seront annulées</li>
                  <li>• Cette action ne peut pas être annulée</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteService}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog (Simplified for now) */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le service</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations du service
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center py-8">
              <Edit className="h-12 w-12 mx-auto mb-4 text-blue-500 opacity-50" />
              <p className="text-gray-500">
                La fonctionnalité d'édition avancée sera disponible prochainement
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Utilisez la page principale des services pour modifier ce service
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/admin/services?edit=${service.id}`)}
            >
              Modifier sur la page principale
            </Button>
            <Button onClick={() => setOpenEditDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceDetailsImproved;