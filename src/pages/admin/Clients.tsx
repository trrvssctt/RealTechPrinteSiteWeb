import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { 
  Users,
  Plus,
  Search,
  Filter,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  Globe,
  Building,
  Eye,
  Edit,
  MoreVertical,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Trash2,
  Upload,
  Download,
  BarChart3,
  TrendingUp,
  CreditCard,
  MessageSquare,
  ShoppingCart,
  User,
  Shield,
  Activity,
  ExternalLink
  ,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { fr } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Clients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [newClient, setNewClient] = useState({
    full_name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    notes: '',
    created_by_channel: 'manual'
  });
  const [clientsStats, setClientsStats] = useState({
    total: 0,
    active: 0,
    newToday: 0,
    totalValue: 0,
    channels: {}
  });

  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    filterAndSortClients();
    calculateStats();
  }, [clients, searchQuery, statusFilter, channelFilter]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/clients', { 
        headers: token ? { Authorization: `Bearer ${token}` } : {} 
      });
      
      if (!resp.ok) throw new Error('Erreur lors du chargement des clients');
      
      const payload = await resp.json();
      const sortedClients = (payload.data || []).sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setClients(sortedClients);
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors du chargement des clients', {
        description: 'Veuillez réessayer'
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortClients = () => {
    let filtered = [...clients];

    // Filtre de recherche
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(client =>
        client.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.phone?.includes(searchQuery) ||
        client.company?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtre par statut
    if (statusFilter === 'active') {
      filtered = filtered.filter(client => client.is_active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(client => !client.is_active);
    }

    // Filtre par canal
    if (channelFilter !== 'all') {
      filtered = filtered.filter(client => client.created_by_channel === channelFilter);
    }

    setFilteredClients(filtered);
    setCurrentPage(1);
    setBulkSelected([]);
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = {
      total: clients.length,
      active: clients.filter(c => c.is_active).length,
      newToday: clients.filter(c => new Date(c.created_at) >= today).length,
      totalValue: clients.reduce((sum, client) => sum + (Number(client.total_spent) || 0), 0),
      channels: clients.reduce((acc, client) => {
        const channel = client.created_by_channel || 'unknown';
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    setClientsStats(stats);
  };

  const handleCreateClient = async () => {
    if (!newClient.email.trim()) {
      toast.error('❌ Email requis', {
        description: 'Veuillez saisir une adresse email'
      });
      return;
    }

    // strict client-side uniqueness check (email & phone)
    const normalizedEmail = (newClient.email || '').trim().toLowerCase();
    const normalizedPhone = (newClient.phone || '').replace(/\D/g, '');
    const conflict = clients.find(c => (c.email || '').toLowerCase() === normalizedEmail || (c.phone || '').replace(/\D/g, '') === normalizedPhone);
    if (conflict) {
      toast.error('❌ Un client avec ce mail ou téléphone existe déjà', {
        description: 'Vérifiez les informations ou utilisez la fiche existante'
      });
      return;
    }

    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/clients', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }, 
        body: JSON.stringify(newClient) 
      });
      
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        if (resp.status === 409) {
          toast.error('❌ Impossible de créer : email ou téléphone déjà utilisé', { description: errBody.error || '' });
          return;
        }
        throw new Error('Erreur lors de la création');
      }

      toast.success('✅ Client créé avec succès', {
        description: `${newClient.full_name || 'Nouveau client'} a été ajouté`
      });
      
      // Réinitialiser le formulaire
      setNewClient({
        full_name: '',
        email: '',
        phone: '',
        company: '',
        address: '',
        notes: '',
        created_by_channel: 'manual'
      });
      
      setCreateDialogOpen(false);
      fetchClients();
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors de la création', {
        description: 'Veuillez vérifier les informations'
      });
    }
  };

  const handleToggleStatus = async (clientId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch(`/api/admin/clients/${clientId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (!resp.ok) throw new Error('Erreur lors de la mise à jour');

      toast.success(`✅ Client ${!currentStatus ? 'activé' : 'désactivé'}`, {
        description: `Le statut a été modifié avec succès`
      });

      fetchClients();
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors de la modification du statut', {
        description: 'Veuillez réessayer'
      });
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch(`/api/admin/clients/${clientToDelete.id}`, { 
        method: 'DELETE', 
        headers: token ? { Authorization: `Bearer ${token}` } : {} 
      });
      
      if (!resp.ok) throw new Error('Erreur lors de la suppression');
      
      toast.success('🗑️ Client marqué comme inactif', {
        description: 'Le client a été désactivé avec succès'
      });
      
      fetchClients();
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors de la suppression', {
        description: 'Veuillez réessayer'
      });
    } finally {
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'export') => {
    if (bulkSelected.length === 0) {
      toast.warning("Aucun client sélectionné");
      return;
    }

    if (action === 'export') {
      // Export CSV des clients sélectionnés
      const selectedClients = clients.filter(c => bulkSelected.includes(c.id));
      const csvContent = [
        ['Nom', 'Email', 'Téléphone', 'Entreprise', 'Statut', 'Canal', 'Date création'],
        ...selectedClients.map(client => [
          client.full_name || client.name || '',
          client.email || '',
          client.phone || '',
          client.company || '',
          client.is_active ? 'Actif' : 'Inactif',
          client.created_by_channel || '',
          format(new Date(client.created_at), 'dd/MM/yyyy')
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `clients_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();

      toast.success('📄 Export CSV réussi', {
        description: `${selectedClients.length} clients exportés`
      });
      return;
    }

    const token = localStorage.getItem('sessionToken');
    let successCount = 0;
    let errorCount = 0;

    for (const id of bulkSelected) {
      try {
        const client = clients.find(c => c.id === id);
        if (!client) continue;

        const resp = await apiFetch(`/api/admin/clients/${id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ 
            is_active: action === 'activate' ? true : false 
          })
        });

        if (!resp.ok) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    toast.success(`Action effectuée`, {
      description: `${successCount} succès, ${errorCount} échecs`
    });

    setBulkSelected([]);
    fetchClients();
  };

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const currentPageIds = currentClients.map(c => c.id);
    
    if (bulkSelected.length === currentPageIds.length) {
      setBulkSelected([]);
    } else {
      setBulkSelected(currentPageIds);
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd MMM yyyy 'à' HH:mm", { locale: fr });
    } catch {
      return "Date invalide";
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

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'manual':
        return <UserPlus className="h-3 w-3" />;
      case 'import':
        return <Upload className="h-3 w-3" />;
      case 'webhook':
        return <Globe className="h-3 w-3" />;
      case 'website':
        return <ExternalLink className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentClients = filteredClients.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gestion des Clients</h1>
              <p className="text-muted-foreground mt-1">
                Gérez votre base de clients et leurs informations
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={fetchClients} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nouveau client
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total clients</p>
                <p className="text-3xl font-bold">{clientsStats.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {clientsStats.newToday} aujourd'hui
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clients actifs</p>
                <p className="text-3xl font-bold text-green-600">{clientsStats.active}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {clientsStats.total > 0 ? Math.round((clientsStats.active / clientsStats.total) * 100) : 0}% taux d'activité
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valeur totale</p>
                <p className="text-3xl font-bold text-indigo-600">{clientsStats.totalValue.toLocaleString()} FCFA</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Chiffre d'affaires total
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sources principales</p>
                <div className="flex gap-2 mt-2">
                  {Object.entries(clientsStats.channels).slice(0, 2).map(([channel, count]) => (
                    <Badge key={channel} variant="outline" className="text-xs">
                      {channel}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Globe className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Rechercher un client (nom, email, téléphone, entreprise...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-11">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actifs uniquement</SelectItem>
                  <SelectItem value="inactive">Inactifs uniquement</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[160px] h-11">
                  <Globe className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les canaux</SelectItem>
                  <SelectItem value="manual">Manuel</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="website">Site web</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={fetchClients}
                className="h-11 w-11"
                disabled={loading}
              >
                <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {bulkSelected.length > 0 && (
        <Card className="bg-muted border">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{bulkSelected.length} client{bulkSelected.length !== 1 ? 's' : ''} sélectionné{bulkSelected.length !== 1 ? 's' : ''}</h3>
                  <p className="text-sm text-muted-foreground">
                    Appliquez une action en masse
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Actions en masse
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkAction('activate')}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Activer
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('deactivate')}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Désactiver
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkAction('export')}>
                      <Download className="mr-2 h-4 w-4" />
                      Exporter en CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBulkSelected([])}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des clients</CardTitle>
          <CardDescription>
            {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''} trouvé{filteredClients.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Aucun client trouvé</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || statusFilter !== "all" || channelFilter !== "all" 
                  ? 'Aucun client ne correspond à vos critères'
                  : 'Commencez par créer votre premier client'
                }
              </p>
              {!searchQuery && statusFilter === "all" && channelFilter === "all" && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Créer un client
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={currentClients.length > 0 && bulkSelected.length === currentClients.length}
                            onChange={toggleSelectAll}
                            className="rounded"
                          />
                        </div>
                      </TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Inscription</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentClients.map((client) => (
                      <TableRow key={client.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={bulkSelected.includes(client.id)}
                              onChange={() => toggleBulkSelect(client.id)}
                              className="rounded"
                            />
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                              {(client.full_name || client.name)?.[0]?.toUpperCase() || 'C'}
                            </div>
                            <div>
                              <div className="font-medium">{client.full_name || client.name || 'Non renseigné'}</div>
                              {client.company && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Building className="h-3 w-3" />
                                  {client.company}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {client.email}
                            </div>
                            {client.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {client.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`${getChannelColor(client.created_by_channel)} gap-1`}
                          >
                            {getChannelIcon(client.created_by_channel)}
                            {client.created_by_channel === 'manual' ? 'Manuel' :
                             client.created_by_channel === 'import' ? 'Import' :
                             client.created_by_channel === 'webhook' ? 'Webhook' :
                             client.created_by_channel === 'website' ? 'Site web' : client.created_by_channel}
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            {formatDateTime(client.created_at)}
                          </div>
                          {client.last_order_date && (
                            <div className="text-xs text-muted-foreground">
                              Dernière commande: {format(new Date(client.last_order_date), 'dd/MM/yy')}
                            </div>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {client.is_active ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-sm font-medium text-green-700">Actif</span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-sm font-medium text-red-700">Inactif</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link to={`/admin/clients/${client.id}`} title="Voir les détails">
                              <Button
                                variant="ghost"
                                size="sm"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => toast.info("Modifier le client")}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleStatus(client.id, client.is_active)}>
                                  {client.is_active ? (
                                    <>
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Désactiver
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Activer
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                  setClientToDelete(client);
                                  setDeleteDialogOpen(true);
                                }}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Affichage de {startIndex + 1} à {Math.min(endIndex, filteredClients.length)} sur {filteredClients.length} clients
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

      {/* Create Client Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Nouveau client
            </DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau client à votre base de données
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nom complet *</Label>
                <Input
                  id="full_name"
                  placeholder="John Doe"
                  value={newClient.full_name}
                  onChange={(e) => setNewClient({...newClient, full_name: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="client@exemple.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  placeholder="+221 XX XXX XX XX"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company">Entreprise</Label>
                <Input
                  id="company"
                  placeholder="Nom de l'entreprise"
                  value={newClient.company}
                  onChange={(e) => setNewClient({...newClient, company: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                placeholder="Adresse complète"
                value={newClient.address}
                onChange={(e) => setNewClient({...newClient, address: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes internes</Label>
              <Textarea
                id="notes"
                placeholder="Informations supplémentaires sur ce client..."
                value={newClient.notes}
                onChange={(e) => setNewClient({...newClient, notes: e.target.value})}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="channel">Source du client</Label>
              <Select 
                value={newClient.created_by_channel} 
                onValueChange={(value) => setNewClient({...newClient, created_by_channel: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manuel</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="website">Site web</SelectItem>
                  <SelectItem value="referral">Parrainage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleCreateClient}>
              <UserPlus className="mr-2 h-4 w-4" />
              Créer le client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Désactiver le client
            </DialogTitle>
            <DialogDescription>
              Marquer ce client comme inactif
            </DialogDescription>
          </DialogHeader>
          
          {clientToDelete && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {(clientToDelete.full_name || clientToDelete.name)?.[0]?.toUpperCase() || 'C'}
                  </div>
                  <div>
                    <div className="font-bold">{clientToDelete.full_name || clientToDelete.name || 'Client'}</div>
                  <div className="text-sm text-muted-foreground">{clientToDelete.email}</div>
                  {clientToDelete.company && (
                    <div className="text-xs text-muted-foreground">
                      {clientToDelete.company}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    Le client sera marqué comme inactif mais ne sera pas supprimé de la base de données.
                    Il pourra être réactivé ultérieurement si nécessaire.
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClient}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Désactiver le client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;