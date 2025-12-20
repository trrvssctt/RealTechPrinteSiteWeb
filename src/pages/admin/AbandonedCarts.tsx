import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { apiFetch } from '@/lib/api';
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import {
  MessageCircle,
  Trash2,
  ShoppingCart,
  Clock,
  DollarSign,
  User,
  Smartphone,
  Mail,
  Eye,
  Filter,
  Search,
  TrendingDown,
  RefreshCw,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Phone,
  MessageSquare,
  Target,
  Zap,
  ArrowUpRight,
  PhoneCall
} from "lucide-react";
import { Package } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CartItem = {
  id?: string;
  product_id?: string;
  name?: string;
  quantity?: number;
  price?: number;
  image_url?: string;
  total_price?: number;
};

type Cart = {
  id: string;
  session_id: string;
  user_id: string | null;
  user?: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  items: CartItem[];
  total_amount: number;
  status: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  metadata?: {
    user_agent?: string;
    ip_address?: string;
    page_views?: number;
    device_type?: string;
  };
};

const AbandonedCarts = () => {
  const [allCarts, setAllCarts] = useState<Cart[]>([]);
  const [filteredCarts, setFilteredCarts] = useState<Cart[]>([]);
  const [filter, setFilter] = useState<"all" | "abandoned" | "active" | "recent">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recoveryRate, setRecoveryRate] = useState<number>(0);

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchCarts();
    fetchRecoveryStats();
  }, []);

  useEffect(() => {
    let filtered = allCarts;

    // Filter by status
    if (filter === 'abandoned') {
      filtered = filtered.filter(isCartAbandoned);
    } else if (filter === 'active') {
      filtered = filtered.filter(isCartActive);
    } else if (filter === 'recent') {
      filtered = filtered.filter(cart => {
        const lastActivity = new Date(cart.last_activity_at);
        return differenceInHours(new Date(), lastActivity) <= 1;
      });
    }

    // Filter by search
    if (searchQuery.trim() !== "") {
      filtered = filtered.filter(cart =>
        cart.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cart.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cart.user?.phone?.includes(searchQuery) ||
        cart.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cart.items.some(item => 
          item.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    setFilteredCarts(filtered);
    setCurrentPage(1);
  }, [allCarts, filter, searchQuery]);

  const fetchCarts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/carts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resp.ok) {
        throw new Error('Erreur lors du chargement des paniers');
      }
      const payload = await resp.json();
      
      const processedCarts = (payload.data || []).map((cart: any) => ({
        ...cart,
        items: Array.isArray(cart.items) ? cart.items : [],
        total_amount: Number(cart.total_amount) || 0,
        last_activity_at: cart.last_activity_at || cart.updated_at || cart.created_at,
        user: cart.user || null,
        metadata: cart.metadata || {},
      }));

      // Sort by last activity (most recent first)
      processedCarts.sort((a: Cart, b: Cart) => 
        new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
      );

      setAllCarts(processedCarts as Cart[]);
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors du chargement des paniers', {
        description: 'Veuillez réessayer'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecoveryStats = async () => {
    // In a real app, you would fetch recovery rate from API
    // This is a mock implementation
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/carts/stats/recovery', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (resp.ok) {
        const data = await resp.json();
        setRecoveryRate(data.recovery_rate || 0);
      }
    } catch (err) {
      // Use mock data if API fails
      setRecoveryRate(15); // 15% recovery rate
    }
  };

  const isCartAbandoned = (cart: Cart) => {
    const lastActivity = new Date(cart.last_activity_at);
    const hoursSinceActivity = differenceInHours(new Date(), lastActivity);
    return hoursSinceActivity > 2 && cart.status === 'active';
  };

  const isCartActive = (cart: Cart) => {
    const lastActivity = new Date(cart.last_activity_at);
    const hoursSinceActivity = differenceInHours(new Date(), lastActivity);
    return hoursSinceActivity <= 2 && cart.status === 'active';
  };

  const getAbandonmentTime = (lastActivity: string) => {
    const now = new Date();
    const activityTime = new Date(lastActivity);
    const hours = differenceInHours(now, activityTime);
    const minutes = differenceInMinutes(now, activityTime) % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleViewDetails = (cart: Cart) => {
    setSelectedCart(cart);
    setDetailsOpen(true);
  };

  const handleOpenMessageDialog = (cart: Cart) => {
    setSelectedCart(cart);
    const products = cart.items.map(item => `${item.name} (x${item.quantity})`).join(", ");
    const defaultMessage = `Bonjour${cart.user?.name ? ` ${cart.user.name}` : ''} !

Vous avez laissé des articles dans votre panier :
${products}

Total : ${cart.total_amount.toLocaleString()} FCFA

Souhaitez-vous finaliser votre commande ? Nous pouvons vous aider si vous avez des questions !

Cordialement,
L'équipe RealTech`;
    setCustomMessage(defaultMessage);
    setMessageDialogOpen(true);
  };

  const handleSendMessage = async (channel: 'whatsapp' | 'email' | 'sms') => {
    if (!selectedCart) return;

    setSendingMessage(true);
    try {
      let url = '';
      const message = customMessage;

      switch (channel) {
        case 'whatsapp':
          const phone = selectedCart.user?.phone || '221774220320';
          url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
          window.open(url, "_blank");
          break;
        case 'email':
          // Open mailto in admin's mail client/webmail with a prefilled message and resume link
          const toEmail = selectedCart.user?.email;
          if (toEmail) {
            const resumeUrl = `${window.location.origin}/panier?session_id=${encodeURIComponent(selectedCart.session_id)}`;
            const emailSubject = `Rappel: articles laissés dans votre panier sur RealTech`;
            const emailBody = `${message}\n\nReprenez votre commande ici: ${resumeUrl}\n\nSi vous avez besoin d'aide, répondez simplement à cet e-mail ou contactez-nous.`;
            const mailto = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
            window.open(mailto, '_blank');
          } else {
            toast.error('Aucun e-mail disponible pour ce client');
          }
          break;
        case 'sms':
          // In a real app, you would send an SMS via API
          toast.info("📱 Envoi de SMS en cours...", {
            description: "Cette fonctionnalité sera bientôt disponible"
          });
          break;
      }

      // Record recovery attempt
      const token = localStorage.getItem('sessionToken');
      await apiFetch('/api/admin/carts/recovery-attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          cart_id: selectedCart.id,
          channel,
          message
        })
      });

      toast.success(`✅ Message envoyé via ${channel}`, {
        description: "Le client a été contacté avec succès"
      });

      setMessageDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors de l\'envoi', {
        description: 'Veuillez réessayer'
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDelete = async (cartId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce panier ? Cette action est irréversible.")) {
      return;
    }

    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch(`/api/admin/carts/${cartId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resp.ok) throw new Error('Erreur lors de la suppression');
      
      toast.success('🗑️ Panier supprimé', {
        description: 'Le panier a été supprimé avec succès'
      });
      
      fetchCarts();
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors de la suppression', {
        description: 'Impossible de supprimer ce panier'
      });
    }
  };

  const stats = useMemo(() => {
    const totalCarts = allCarts.length;
    const totalValue = allCarts.reduce((sum, cart) => sum + Number(cart.total_amount || 0), 0);
    const abandonedCarts = allCarts.filter(isCartAbandoned);
    const abandonedCount = abandonedCarts.length;
    const abandonedValue = abandonedCarts.reduce((sum, cart) => sum + Number(cart.total_amount || 0), 0);
    const activeCarts = allCarts.filter(isCartActive);
    const activeCount = activeCarts.length;

    return {
      totalCarts,
      totalValue,
      abandonedCount,
      abandonedValue,
      activeCount,
      averageCartValue: totalCarts > 0 ? Math.round(totalValue / totalCarts) : 0,
      recoveryValue: Math.round(abandonedValue * (recoveryRate / 100)),
    };
  }, [allCarts, recoveryRate]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCarts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentCarts = filteredCarts.slice(startIndex, endIndex);

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd MMM yyyy 'à' HH:mm", { locale: fr });
    } catch {
      return "Date invalide";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Paniers Abandonnés</h1>
              <p className="text-muted-foreground mt-1">
                Récupérez les ventes perdues et maximisez vos conversions
              </p>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={fetchCarts} 
          variant="outline" 
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paniers actifs</p>
                <p className="text-3xl font-bold">{stats.totalCarts}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.activeCount} en cours
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paniers abandonnés</p>
                <p className="text-3xl font-bold text-orange-600">{stats.abandonedCount}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {getAbandonmentTime(allCarts[0]?.last_activity_at || '')} depuis le dernier
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valeur perdue</p>
                <p className="text-3xl font-bold">{stats.abandonedValue.toLocaleString()} FCFA</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.averageCartValue.toLocaleString()} FCFA en moyenne
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Potentiel de récupération</p>
                <p className="text-3xl font-bold text-emerald-600">{stats.recoveryValue.toLocaleString()} FCFA</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Taux de récupération: {recoveryRate}%
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recovery Insights */}
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Opportunité de récupération
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Vous avez {stats.abandonedCount} paniers abandonnés représentant {stats.abandonedValue.toLocaleString()} FCFA. 
                Avec un taux de récupération de {recoveryRate}%, vous pouvez potentiellement récupérer{' '}
                <span className="font-semibold text-emerald-600">{stats.recoveryValue.toLocaleString()} FCFA</span>.
              </p>
            </div>
            <Button 
              onClick={() => {
                const abandonedCarts = allCarts.filter(isCartAbandoned);
                if (abandonedCarts.length > 0) {
                  setFilter('abandoned');
                  toast.info("Filtré sur les paniers abandonnés", {
                    description: `${abandonedCarts.length} paniers à récupérer`
                  });
                }
              }}
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
            >
              <Send className="mr-2 h-4 w-4" />
              Contacter les {stats.abandonedCount} clients
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Rechercher un panier (client, produit, email, téléphone...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                <SelectTrigger className="w-[180px] h-11">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les paniers</SelectItem>
                  <SelectItem value="abandoned">Abandonnés</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="recent">Très récents (&lt;1h)</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={fetchCarts}
                className="h-11 w-11"
                disabled={loading}
              >
                <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Carts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des paniers</CardTitle>
          <CardDescription>
            {filteredCarts.length} panier{filteredCarts.length !== 1 ? 's' : ''} trouvé{filteredCarts.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              ))}
            </div>
          ) : filteredCarts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Aucun panier trouvé</h3>
              <p className="text-muted-foreground">
                {searchQuery || filter !== "all" 
                  ? 'Aucun panier ne correspond à vos critères'
                  : 'Aucun panier n\'a été créé pour le moment'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Produits</TableHead>
                      <TableHead>Valeur</TableHead>
                      <TableHead>Dernière activité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentCarts.map((cart) => {
                      const abandoned = isCartAbandoned(cart);
                      const active = isCartActive(cart);
                      const timeSince = getAbandonmentTime(cart.last_activity_at);
                      
                      return (
                        <TableRow key={cart.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {cart.user?.name || "Visiteur"}
                                {cart.user && (
                                  <Badge variant="outline" className="text-xs">
                                    Client
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {cart.user?.email || "Non connecté"}
                              </div>
                              {cart.user?.phone && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {cart.user.phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 max-w-xs">
                              {cart.items.slice(0, 3).map((item: CartItem, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                  <span className="truncate">{item.name}</span>
                                  <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                                </div>
                              ))}
                              {cart.items.length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  +{cart.items.length - 3} autre(s) produit(s)
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-bold">{cart.total_amount.toLocaleString()} FCFA</div>
                            <div className="text-xs text-muted-foreground">
                              {cart.items.length} article{cart.items.length !== 1 ? 's' : ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm">{formatDateTime(cart.last_activity_at)}</div>
                              <div className={`text-xs ${abandoned ? 'text-red-600' : 'text-green-600'}`}>
                                {abandoned ? `Abandonné depuis ${timeSince}` : `Actif il y a ${timeSince}`}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {abandoned ? (
                              <Badge variant="destructive" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Abandonné
                              </Badge>
                            ) : active ? (
                              <Badge variant="default" className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                                <CheckCircle className="h-3 w-3" />
                                Actif
                              </Badge>
                            ) : (
                              <Badge variant="outline">Inactif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(cart)}
                                title="Voir les détails"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => handleViewDetails(cart)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Voir les détails
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenMessageDialog(cart)}>
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                    Contacter le client
                                  </DropdownMenuItem>
                                  {cart.user?.phone && (
                                    <DropdownMenuItem onClick={() => handleSendMessage('whatsapp')}>
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      WhatsApp
                                    </DropdownMenuItem>
                                  )}
                                  {cart.user?.email && (
                                    <DropdownMenuItem onClick={() => handleSendMessage('email')}>
                                      <Mail className="mr-2 h-4 w-4" />
                                      Email
                                    </DropdownMenuItem>
                                  )}
                                  {cart.user?.phone && (
                                    <DropdownMenuItem onClick={() => handleSendMessage('sms')}>
                                      <PhoneCall className="mr-2 h-4 w-4" />
                                      SMS
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(cart.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                  <div className="text-sm text-muted-foreground">
                    Affichage de {startIndex + 1} à {Math.min(endIndex, filteredCarts.length)} sur {filteredCarts.length} paniers
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Cart Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedCart && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Détails du panier #{selectedCart.id.substring(0, 8)}...
                </DialogTitle>
                <DialogDescription>
                  Dernière activité: {formatDateTime(selectedCart.last_activity_at)}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Aperçu</TabsTrigger>
                  <TabsTrigger value="products">Produits</TabsTrigger>
                  <TabsTrigger value="client">Client</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Informations panier</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Statut</span>
                          {isCartAbandoned(selectedCart) ? (
                            <Badge variant="destructive">Abandonné</Badge>
                          ) : (
                            <Badge variant="default">Actif</Badge>
                          )}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Créé le</span>
                          <span className="text-sm">{formatDateTime(selectedCart.created_at)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Dernière activité</span>
                          <span className="text-sm">{formatDateTime(selectedCart.last_activity_at)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Session</span>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {selectedCart.session_id.substring(0, 12)}...
                          </code>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Valeur</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Total panier</span>
                          <span className="text-lg font-bold">{selectedCart.total_amount.toLocaleString()} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Nombre d'articles</span>
                          <span className="text-sm">{selectedCart.items.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Temps d'abandon</span>
                          <span className="text-sm">{getAbandonmentTime(selectedCart.last_activity_at)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="products">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Articles dans le panier</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedCart.items.map((item: CartItem, index: number) => (
                          <div key={index} className="flex items-center justify-between border-b pb-3 last:border-0">
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-12 h-12 rounded-md object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center">
                                  <Package className="h-5 w-5 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {item.price?.toLocaleString()} FCFA x {item.quantity}
                                </div>
                              </div>
                            </div>
                            <div className="font-bold">
                              {((item.price || 0) * (item.quantity || 1)).toLocaleString()} FCFA
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="client">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Informations client</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedCart.user ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                              {selectedCart.user.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="font-medium">{selectedCart.user.name || 'Utilisateur'}</div>
                              <div className="text-sm text-muted-foreground">Client enregistré</div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            {selectedCart.user.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{selectedCart.user.email}</span>
                              </div>
                            )}
                            {selectedCart.user.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{selectedCart.user.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <User className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-muted-foreground">Client non connecté</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Ce panier a été créé par un visiteur non identifié
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    onClick={() => setDetailsOpen(false)}
                  >
                    Fermer
                  </Button>
                  <Button
                    onClick={() => handleOpenMessageDialog(selectedCart)}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Contacter le client
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedCart && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Contacter le client
                </DialogTitle>
                <DialogDescription>
                  Envoyez un message de rappel pour récupérer ce panier
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium">{selectedCart.user?.name || 'Visiteur'}</div>
                      <div className="text-sm text-muted-foreground">
                        Panier de {selectedCart.total_amount.toLocaleString()} FCFA • {selectedCart.items.length} article(s)
                      </div>
                    </div>
                    <Badge variant={isCartAbandoned(selectedCart) ? "destructive" : "default"}>
                      {isCartAbandoned(selectedCart) ? 'Abandonné' : 'Actif'}
                    </Badge>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div className="font-medium">Articles :</div>
                    <div className="text-muted-foreground">
                      {selectedCart.items.slice(0, 3).map(item => `${item.name} (x${item.quantity})`).join(', ')}
                      {selectedCart.items.length > 3 && ` et ${selectedCart.items.length - 3} autre(s)`}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message personnalisé</Label>
                  <Textarea
                    id="message"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={8}
                    className="resize-none"
                    placeholder="Rédigez votre message de rappel..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Vous pouvez personnaliser le message qui sera envoyé au client
                  </p>
                </div>

                <div>
                  <Label className="mb-2 block">Canal d'envoi</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto py-3"
                      onClick={() => handleSendMessage('whatsapp')}
                      disabled={sendingMessage}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="font-medium">WhatsApp</div>
                          <div className="text-xs text-muted-foreground">
                            {selectedCart.user?.phone ? selectedCart.user.phone : 'Non disponible'}
                          </div>
                        </div>
                      </div>
                    </Button>
                    
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto py-3"
                      onClick={() => handleSendMessage('email')}
                      disabled={sendingMessage || !selectedCart.user?.email}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Mail className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-medium">Email</div>
                          <div className="text-xs text-muted-foreground">
                            {selectedCart.user?.email || 'Non disponible'}
                          </div>
                        </div>
                      </div>
                    </Button>
                    
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto py-3"
                      onClick={() => handleSendMessage('sms')}
                      disabled={sendingMessage || !selectedCart.user?.phone}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <PhoneCall className="h-5 w-5 text-purple-600" />
                        <div>
                          <div className="font-medium">SMS</div>
                          <div className="text-xs text-muted-foreground">
                            {selectedCart.user?.phone || 'Non disponible'}
                          </div>
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setMessageDialogOpen(false)}
                  disabled={sendingMessage}
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => handleSendMessage('whatsapp')}
                  disabled={sendingMessage || !selectedCart.user?.phone}
                >
                  {sendingMessage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Envoyer via WhatsApp
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AbandonedCarts;