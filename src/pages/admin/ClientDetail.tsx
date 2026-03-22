import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  format, 
  differenceInDays, 
  differenceInHours,
  startOfMonth,
  endOfMonth,
  subMonths
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { apiFetch } from '@/lib/api';
import { 
  ArrowLeft, 
  ShoppingCart, 
  CreditCard, 
  Calendar, 
  DollarSign, 
  User,
  Mail,
  Phone,
  Building,
  Globe,
  TrendingUp,
  Activity,
  RefreshCw,
  Eye,
  Edit,
  MoreVertical,
  MessageSquare,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  MapPin,
  Clock,
  Users,
  Target,
  ExternalLink,
  Copy,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [carts, setCarts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  

  // Statistiques calculées
  const clientStats = useMemo(() => {
    if (!client) return null;
    
    const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Commandes du mois en cours
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    const currentMonthOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= monthStart && orderDate <= monthEnd;
    });
    
    const currentMonthRevenue = currentMonthOrders.reduce((sum, order) => 
      sum + (Number(order.total_amount) || 0), 0
    );
    
    // Commandes du mois précédent
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    
    const lastMonthOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
    });
    
    const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => 
      sum + (Number(order.total_amount) || 0), 0
    );
    
    // Calcul de la variation
    const revenueGrowth = lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : currentMonthRevenue > 0 ? 100 : 0;
    
    // Paniers actifs
    const activeCarts = carts.filter(cart => {
      const lastActivity = new Date(cart.last_activity_at || cart.updated_at);
      return differenceInHours(new Date(), lastActivity) <= 2;
    });
    
    // Taux de conversion
    const conversionRate = totalOrders > 0 ? Math.min(100, (totalOrders / (totalOrders + carts.length)) * 100) : 0;
    
    // Dernière activité
    const lastOrder = orders[0];
    const lastLogin = client.last_login_at;
    const lastActivity = lastOrder?.created_at || lastLogin || client.updated_at;
    
    return {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      currentMonthRevenue,
      lastMonthRevenue,
      revenueGrowth,
      activeCarts: activeCarts.length,
      totalCarts: carts.length,
      conversionRate,
      messagesCount: messages.length,
      daysAsClient: client.created_at ? 
        differenceInDays(new Date(), new Date(client.created_at)) : 0,
      lastActivity
    };
  }, [client, orders, carts, messages]);

  const fetchClientData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch client details (use ID)
      const clientRes = await apiFetch(`/api/admin/clients/${id}`, { headers });
      let fetchedClient: any = null;
      if (clientRes.ok) {
        const clientData = await clientRes.json();
        fetchedClient = clientData.data || clientData;
        setClient(fetchedClient);
      }

      // Fetch client orders
      const ordersRes = await apiFetch(`/api/admin/orders?client_id=${id}`, { headers });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders((ordersData.data || []).sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }

      // Fetch client carts
      const cartsRes = await apiFetch(`/api/admin/carts?client_id=${id}`, { headers });
      if (cartsRes.ok) {
        const cartsData = await cartsRes.json();
        setCarts(cartsData.data || []);
      }

      // Fetch client messages using fetchedClient.email (fallback to existing client.email)
      const emailToQuery = fetchedClient?.email || client?.email;
      if (emailToQuery) {
        const messagesRes = await apiFetch(`/api/contacts?email=${encodeURIComponent(emailToQuery)}`, { headers });
        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          setMessages(messagesData.results || messagesData.data || []);
        }
      }

    } catch (err) {
      console.error('Error fetching client data:', err);
      toast.error('❌ Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
    // Setup refresh interval (every 15 seconds)
    const interval = setInterval(fetchClientData, 15000);
    return () => {
      clearInterval(interval);
    };
  }, [id]);

  const handleRefresh = () => {
    fetchClientData();
    toast.info('🔄 Actualisation des données...');
  };

  const handleContactClient = () => {
    if (!client?.email) return;
    
    const subject = encodeURIComponent(`RealTech Holding - Suivi de votre compte`);
    const body = encodeURIComponent(`Bonjour ${client.full_name || client.name || ''},\n\nNous vous contactons concernant votre compte chez RealTech Holding.\n\nCordialement,\nL'équipe RealTech`);
    
    window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCopyEmail = () => {
    if (!client?.email) return;
    
    navigator.clipboard.writeText(client.email);
    toast.success('📋 Email copié dans le presse-papier');
  };

  const handleViewOrder = (orderId: string) => {
    navigate(`/admin/orders/${orderId}`);
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd MMM yyyy 'à' HH:mm", { locale: fr });
    } catch {
      return "Date invalide";
    }
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const hours = differenceInHours(now, date);
      
      if (hours < 1) return "Il y a moins d'une heure";
      if (hours < 24) return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
      
      const days = differenceInDays(now, date);
      if (days === 1) return "Hier";
      if (days < 7) return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
      
      return format(date, "dd/MM/yyyy", { locale: fr });
    } catch {
      return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
      case 'refunded':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'shipped':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'manual':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'import':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'webhook':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'website':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCartStatus = (cart: any) => {
    const lastActivity = new Date(cart.last_activity_at || cart.updated_at);
    const hoursSinceActivity = differenceInHours(new Date(), lastActivity);
    
    if (hoursSinceActivity <= 2) {
      return { label: 'Actif', color: 'bg-green-100 text-green-800 border-green-200' };
    } else if (hoursSinceActivity <= 24) {
      return { label: 'Inactif', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    } else {
      return { label: 'Abandonné', color: 'bg-red-100 text-red-800 border-red-200' };
    }
  };

  if (loading && !client) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <User className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Client introuvable</h2>
        <p className="text-muted-foreground mb-6">Le client avec l'ID "{id}" n'existe pas ou a été supprimé.</p>
        <Button asChild>
          <Link to="/admin/clients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" asChild>
            <Link to="/admin/clients">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Détails du Client</h1>
            <p className="text-muted-foreground mt-1">
              {client.full_name || client.name || 'Client sans nom'} • Client depuis {clientStats?.daysAsClient} jour{clientStats?.daysAsClient !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleContactClient}
          >
            <Send className="mr-2 h-4 w-4" />
            Contacter
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => toast.info("Modification du client")}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyEmail}>
                <Copy className="mr-2 h-4 w-4" />
                Copier l'email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <MessageSquare className="mr-2 h-4 w-4" />
                Envoyer un message
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Target className="mr-2 h-4 w-4" />
                Créer une promotion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : Profil et informations */}
        <div className="space-y-6">
          {/* Carte Profil */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                  {(client.full_name || client.name)?.[0]?.toUpperCase() || 'C'}
                </div>
                <div>
                  <div className="text-xl font-bold">{client.full_name || client.name || 'Client sans nom'}</div>
                  <div className="text-sm text-muted-foreground">{client.email}</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={getChannelColor(client.created_by_channel)}>
                    {client.created_by_channel === 'manual' ? 'Client manuel' :
                     client.created_by_channel === 'import' ? 'Importé' :
                     client.created_by_channel === 'webhook' ? 'Webhook' :
                     client.created_by_channel === 'website' ? 'Site web' : client.created_by_channel}
                  </Badge>
                  
                  <Badge variant={client.is_active ? "default" : "destructive"}>
                    {client.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>

                <Separator />

                {/* Informations de contact */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{client.email}</div>
                      <div className="text-xs text-muted-foreground">Email</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleCopyEmail}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {client.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{client.phone}</div>
                        <div className="text-xs text-muted-foreground">Téléphone</div>
                      </div>
                    </div>
                  )}
                  
                  {client.company && (
                    <div className="flex items-center gap-3">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{client.company}</div>
                        <div className="text-xs text-muted-foreground">Entreprise</div>
                      </div>
                    </div>
                  )}
                  
                  {client.address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{client.address}</div>
                        <div className="text-xs text-muted-foreground">Adresse</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{formatDateTime(client.created_at)}</div>
                      <div className="text-xs text-muted-foreground">Inscription</div>
                    </div>
                  </div>
                    {client.created_by_user_info && (
                      <div className="flex items-center gap-3 mt-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">Créé par {client.created_by_user_info.name || client.created_by_user_info.id}</div>
                          <div className="text-xs text-muted-foreground">{client.created_by_user_info.email}</div>
                        </div>
                      </div>
                    )}

                    {client.updated_by_user_info && (
                      <div className="flex items-center gap-3 mt-2">
                        <Edit className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">Dernière modification par {client.updated_by_user_info.name || client.updated_by_user_info.id}</div>
                          <div className="text-xs text-muted-foreground">{client.updated_by_user_info.email}</div>
                        </div>
                      </div>
                    )}
                  
                  {client.last_login_at && (
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{formatRelativeTime(client.last_login_at)}</div>
                        <div className="text-xs text-muted-foreground">Dernière connexion</div>
                      </div>
                    </div>
                  )}
                </div>
                
                {client.notes && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-sm font-medium mb-2">Notes internes</div>
                      <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                        {client.notes}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Carte Engagement */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Engagement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taux de conversion</span>
                  <span className="font-bold">{clientStats?.conversionRate.toFixed(1)}%</span>
                </div>
                <Progress value={clientStats?.conversionRate || 0} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fidélité</span>
                  <span className="font-bold">{clientStats?.daysAsClient} jour{clientStats?.daysAsClient !== 1 ? 's' : ''}</span>
                </div>
                <Progress value={Math.min((clientStats?.daysAsClient || 0) / 365 * 100, 100)} className="h-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{clientStats?.activeCarts || 0}</div>
                  <div className="text-xs text-muted-foreground">Paniers actifs</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{clientStats?.messagesCount || 0}</div>
                  <div className="text-xs text-muted-foreground">Messages</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colonne droite : Données et analytics */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="overview" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Vue d'ensemble
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Commandes ({orders.length})
              </TabsTrigger>
              <TabsTrigger value="carts" className="gap-2">
                <Package className="h-4 w-4" />
                Paniers ({carts.length})
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages ({messages.length})
              </TabsTrigger>
            </TabsList>

            {/* Vue d'ensemble */}
            <TabsContent value="overview" className="space-y-6">
              {/* Cartes de statistiques financières */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Chiffre d'affaires total
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-700">
                      {clientStats?.totalRevenue.toLocaleString()} FCFA
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      {clientStats?.totalOrders} commande{clientStats?.totalOrders !== 1 ? 's' : ''}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      Ce mois-ci
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {clientStats?.currentMonthRevenue.toLocaleString()} FCFA
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {clientStats?.revenueGrowth >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
                      )}
                      <span className={`text-sm ${clientStats?.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(clientStats?.revenueGrowth || 0).toFixed(1)}% vs mois dernier
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Dernières commandes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Dernières commandes
                  </CardTitle>
                  <CardDescription>
                    {orders.length} commande{orders.length !== 1 ? 's' : ''} au total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {orders.slice(0, 3).map(order => (
                      <div 
                        key={order.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleViewOrder(order.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">
                              Commande #{order.order_number || order.id.substring(0, 8)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDateTime(order.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">
                            {Number(order.total_amount || 0).toLocaleString()} FCFA
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`${getStatusColor(order.status)} text-xs mt-1`}
                          >
                            {order.status || 'En attente'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    
                    {orders.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Aucune commande pour ce client
                      </div>
                    )}
                    
                    {orders.length > 3 && (
                      <div className="text-center pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab('orders')}>
                          Voir toutes les commandes ({orders.length})
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Paniers actifs */}
              {clientStats?.activeCarts > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Paniers actifs ({clientStats.activeCarts})
                    </CardTitle>
                    <CardDescription>
                      Paniers en cours d'achat
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {carts.filter(cart => {
                        const lastActivity = new Date(cart.last_activity_at || cart.updated_at);
                        return differenceInHours(new Date(), lastActivity) <= 2;
                      }).slice(0, 3).map(cart => {
                        const status = getCartStatus(cart);
                        return (
                          <div key={cart.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">Panier {cart.id.substring(0, 8)}...</div>
                              <div className="text-sm text-muted-foreground">
                                Dernière activité: {formatRelativeTime(cart.last_activity_at || cart.updated_at)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">
                                {Number(cart.total_amount || 0).toLocaleString()} FCFA
                              </div>
                              <Badge variant="outline" className={`${status.color} text-xs mt-1`}>
                                {status.label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Commandes complètes */}
            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle>Historique des commandes</CardTitle>
                  <CardDescription>
                    {orders.length} commande{orders.length !== 1 ? 's' : ''} • Total: {clientStats?.totalRevenue.toLocaleString()} FCFA
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Commande</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Articles</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map(order => (
                          <TableRow key={order.id} className="hover:bg-muted/50">
                            <TableCell>
                              <div className="font-medium">#{order.order_number || order.id.substring(0, 8)}</div>
                              <div className="text-xs text-muted-foreground">
                                {order.items?.length || 0} article{order.items?.length !== 1 ? 's' : ''}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDateTime(order.created_at)}
                            </TableCell>
                            <TableCell>
                              {order.items?.slice(0, 2).map((item: any) => item.name).join(', ')}
                              {order.items?.length > 2 && ` +${order.items.length - 2}`}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`${getStatusColor(order.status)}`}
                              >
                                {order.status === 'completed' ? 'Terminée' :
                                 order.status === 'pending' ? 'En attente' :
                                 order.status === 'shipped' ? 'Expédiée' :
                                 order.status === 'cancelled' ? 'Annulée' : order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {Number(order.total_amount || 0).toLocaleString()} FCFA
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewOrder(order.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {orders.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Aucune commande pour ce client
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Paniers */}
            <TabsContent value="carts">
              <Card>
                <CardHeader>
                  <CardTitle>Historique des paniers</CardTitle>
                  <CardDescription>
                    {carts.length} panier{carts.length !== 1 ? 's' : ''} • {clientStats?.activeCarts} actif{clientStats?.activeCarts !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Panier</TableHead>
                          <TableHead>Dernière activité</TableHead>
                          <TableHead>Articles</TableHead>
                          <TableHead>Valeur</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {carts.map(cart => {
                          const status = getCartStatus(cart);
                          const items = cart.items || [];
                          
                          return (
                            <TableRow key={cart.id}>
                              <TableCell className="font-mono text-sm">
                                {cart.id.substring(0, 12)}...
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{formatDateTime(cart.last_activity_at || cart.updated_at)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatRelativeTime(cart.last_activity_at || cart.updated_at)}
                                </div>
                              </TableCell>
                              <TableCell>
                                {items.slice(0, 2).map((item: any) => item.name).join(', ')}
                                {items.length > 2 && ` +${items.length - 2}`}
                              </TableCell>
                              <TableCell className="font-bold">
                                {Number(cart.total_amount || 0).toLocaleString()} FCFA
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={status.color}>
                                  {status.label}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        
                        {carts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Aucun panier pour ce client
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Messages */}
            <TabsContent value="messages">
              <Card>
                <CardHeader>
                  <CardTitle>Messages de contact</CardTitle>
                  <CardDescription>
                    {messages.length} message{messages.length !== 1 ? 's' : ''} envoyé{messages.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {messages.map(message => (
                      <Card key={message.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-bold">{message.subject}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatDateTime(message.created_at)}
                              </div>
                            </div>
                            <Badge variant={message.handled ? "default" : "destructive"}>
                              {message.handled ? 'Traité' : 'Non traité'}
                            </Badge>
                          </div>
                          <div className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap">
                            {message.message}
                          </div>
                          {message.metadata && (
                            <div className="mt-3 text-xs text-muted-foreground">
                              IP: {message.metadata.ip_address || 'N/A'} • 
                              Page: {message.metadata.page_url || 'N/A'}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    
                    {messages.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        Aucun message envoyé par ce client
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ClientDetail;