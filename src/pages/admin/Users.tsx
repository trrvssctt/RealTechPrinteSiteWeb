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
  CardHeader, 
  CardTitle, 
  CardContent,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Search,
  Filter,
  Users,
  Shield,
  Mail,
  User,
  Phone,
  Calendar,
  Eye,
  MoreVertical,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  Activity,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserModal from '@/components/admin/UserModal';

const AdminUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [userStats, setUserStats] = useState({
    total: 0,
    active: 0,
    admins: 0,
    today: 0,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterAndSortUsers();
    calculateStats();
  }, [users, searchQuery, roleFilter, statusFilter, sortBy, sortOrder]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resp.ok) throw new Error('Erreur lors du chargement des utilisateurs');
      const payload = await resp.json();
      
      // Trier par date de création (plus récent d'abord)
      const sortedUsers = (payload.data || []).sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setUsers(sortedUsers);
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors du chargement des utilisateurs', {
        description: 'Veuillez réessayer'
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortUsers = () => {
    let filtered = [...users];

    // Filtre de recherche
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone?.includes(searchQuery)
      );
    }

    // Filtre par rôle
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Filtre par statut
    if (statusFilter === 'active') {
      filtered = filtered.filter(user => user.is_active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(user => !user.is_active);
    }

    // Tri
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'name') {
        aValue = a.name || '';
        bValue = b.name || '';
      }

      if (sortBy === 'email') {
        aValue = a.email || '';
        bValue = b.email || '';
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (sortBy === 'created_at') {
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
      }

      return sortOrder === 'asc'
        ? (aValue > bValue ? 1 : -1)
        : (bValue > aValue ? 1 : -1);
    });

    setFilteredUsers(filtered);
    setCurrentPage(1);
    setBulkSelected([]);
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = {
      total: users.length,
      active: users.filter(u => u.is_active).length,
      admins: users.filter(u => u.role === 'admin').length,
      today: users.filter(u => new Date(u.created_at) >= today).length,
    };

    setUserStats(stats);
  };

  const handleDelete = async (userId: string) => {
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch(`/api/admin/users/${userId}`, { 
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (!resp.ok) throw new Error('Erreur lors de la suppression');
      
      toast.success('🗑️ Utilisateur supprimé', {
        description: 'L\'utilisateur a été supprimé avec succès'
      });
      
      fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error('❌ Impossible de supprimer l\'utilisateur', {
        description: 'Veuillez réessayer'
      });
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (!resp.ok) throw new Error('Erreur lors de la mise à jour');

      toast.success(`✅ Utilisateur ${!currentStatus ? 'activé' : 'désactivé'}`, {
        description: `Le statut a été modifié avec succès`
      });

      fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors de la modification du statut', {
        description: 'Veuillez réessayer'
      });
    }
  };

  const handleBulkAction = async (action: 'delete' | 'activate' | 'deactivate') => {
    if (bulkSelected.length === 0) {
      toast.warning("Aucun utilisateur sélectionné");
      return;
    }

    const token = localStorage.getItem('sessionToken');
    let successCount = 0;
    let errorCount = 0;

    for (const id of bulkSelected) {
      try {
        let resp;
        
        switch (action) {
          case 'delete':
            resp = await apiFetch(`/api/admin/users/${id}`, { 
              method: 'DELETE',
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            break;
          
          case 'activate':
            resp = await apiFetch(`/api/admin/users/${id}`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ is_active: true })
            });
            break;
          
          case 'deactivate':
            resp = await apiFetch(`/api/admin/users/${id}`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ is_active: false })
            });
            break;
        }

        if (resp && !resp.ok) {
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
    fetchUsers();
  };

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const currentPageIds = currentUsers.map(u => u.id);
    
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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'moderator':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'staff':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'customer':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'moderator':
        return <Users className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gestion des Utilisateurs</h1>
              <p className="text-muted-foreground mt-1">
                Gérez les comptes utilisateurs et leurs permissions
              </p>
            </div>
          </div>
        </div>
        
          <div className="flex items-center gap-2">
          <Button 
            onClick={fetchUsers} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={() => { setEditingUser(null); setModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel utilisateur
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total utilisateurs</p>
                <p className="text-3xl font-bold">{userStats.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {userStats.today} aujourd'hui
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
                <p className="text-sm font-medium text-muted-foreground">Utilisateurs actifs</p>
                <p className="text-3xl font-bold text-green-600">{userStats.active}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round((userStats.active / userStats.total) * 100) || 0}% actifs
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
                <p className="text-sm font-medium text-muted-foreground">Administrateurs</p>
                <p className="text-3xl font-bold text-red-600">{userStats.admins}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Accès complet
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inactifs</p>
                <p className="text-3xl font-bold text-orange-600">{userStats.total - userStats.active}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Comptes désactivés
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-orange-600" />
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
                placeholder="Rechercher un utilisateur (nom, email, téléphone...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px] h-11">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rôles</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="moderator">Modérateur</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="customer">Client</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-11">
                  <Activity className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actifs uniquement</SelectItem>
                  <SelectItem value="inactive">Inactifs uniquement</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={fetchUsers}
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
                  <h3 className="font-semibold">{bulkSelected.length} utilisateur{bulkSelected.length !== 1 ? 's' : ''} sélectionné{bulkSelected.length !== 1 ? 's' : ''}</h3>
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
                    <DropdownMenuItem 
                      onClick={() => handleBulkAction('delete')}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
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

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs</CardTitle>
          <CardDescription>
            {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''} trouvé{filteredUsers.length !== 1 ? 's' : ''}
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
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Aucun utilisateur trouvé</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || roleFilter !== "all" || statusFilter !== "all" 
                  ? 'Aucun utilisateur ne correspond à vos critères'
                  : 'Commencez par créer votre premier utilisateur'
                }
              </p>
              {!searchQuery && roleFilter === "all" && statusFilter === "all" && (
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un utilisateur
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
                            checked={currentUsers.length > 0 && bulkSelected.length === currentUsers.length}
                            onChange={toggleSelectAll}
                            className="rounded"
                          />
                        </div>
                      </TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Inscription</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={bulkSelected.includes(user.id)}
                              onChange={() => toggleBulkSelect(user.id)}
                              className="rounded"
                            />
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                              {user.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="font-medium">{user.name || 'Non renseigné'}</div>
                              <div className="text-xs text-muted-foreground">
                                ID: {user.id?.substring(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {user.email}
                            </div>
                            {user.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`${getRoleColor(user.role)} gap-1`}
                          >
                            {getRoleIcon(user.role)}
                            {user.role === 'admin' ? 'Administrateur' : 
                             user.role === 'moderator' ? 'Modérateur' : 
                             user.role === 'staff' ? 'Staff' : 'Client'}
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {user.is_active ? (
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
                        
                        <TableCell>
                          <div className="text-sm space-y-1">
                            <div>{formatDateTime(user.created_at)}</div>
                            {user.last_login && (
                              <div className="text-xs text-muted-foreground">
                                Dernière connexion: {formatDateTime(user.last_login)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toast.info("Détails de l'utilisateur")}
                              title="Voir les détails"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingUser(user); setModalOpen(true); }}
                              title="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => toast.info("Modifier l'utilisateur")}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleStatus(user.id, user.is_active)}>
                                  {user.is_active ? (
                                    <>
                                      <Lock className="mr-2 h-4 w-4" />
                                      Désactiver
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="mr-2 h-4 w-4" />
                                      Activer
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setUserToDelete(user);
                                    setDeleteDialogOpen(true);
                                  }}
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
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Affichage de {startIndex + 1} à {Math.min(endIndex, filteredUsers.length)} sur {filteredUsers.length} utilisateurs
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Supprimer l'utilisateur
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          
          {userToDelete && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                  {userToDelete.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="font-bold">{userToDelete.name || 'Utilisateur'}</div>
                  <div className="text-sm text-muted-foreground">{userToDelete.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Inscrit le {formatDateTime(userToDelete.created_at)}
                  </div>
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-sm text-red-700">
                  ⚠️ Cette action supprimera définitivement le compte de l'utilisateur et toutes ses données associées.
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
              onClick={() => userToDelete && handleDelete(userToDelete.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UserModal open={modalOpen} onOpenChange={setModalOpen} user={editingUser} onSaved={() => { setModalOpen(false); fetchUsers(); }} />
    </div>
  );
};

export default AdminUsers;