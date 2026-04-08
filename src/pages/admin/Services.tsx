import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { 
  Plus, Search, Filter, RefreshCw, Edit, Trash2, Eye,
  Clock, DollarSign, Tag, CheckCircle, XCircle,
  MoreVertical, TrendingUp, Users, BarChart3, Settings,
  Calendar, Star, Award, Shield, Zap
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ServicesPageImproved = () => {
  const [services, setServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [activeTab, setActiveTab] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    averagePrice: 0,
    totalDuration: 0
  });

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    purchase_price: 0,
    duration_minutes: 0,
    category: 'general',
    is_active: true,
    tags: [] as string[],
    requires_approval: false,
    max_participants: 1,
    color_code: '#3b82f6'
  });

  const categories = [
    { value: 'general', label: 'Général', icon: Tag },
    { value: 'premium', label: 'Premium', icon: Star },
    { value: 'training', label: 'Formation', icon: Users },
    { value: 'consulting', label: 'Consulting', icon: BarChart3 },
    { value: 'maintenance', label: 'Maintenance', icon: Settings },
    { value: 'support', label: 'Support', icon: Shield }
  ];

  const navigate = useNavigate();

  const [isEmployee, setIsEmployee] = useState(false);

  useEffect(() => {
    const detectRole = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        if (!token) return;
        const resp = await apiFetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) return;
        const json = await resp.json().catch(() => ({}));
        const rawRoles = json.user?.roles || json.roles || [];
        const roles: string[] = Array.isArray(rawRoles)
          ? rawRoles.map((r: any) => (r || '').toString().toLowerCase())
          : [];
        const employeeRoles = ['employe', 'employé', 'employee', 'staff', 'assistant', 'agent'];
        if (roles.some((role) => employeeRoles.includes(role))) setIsEmployee(true);
      } catch (e) {
        // ignore
      }
    };
    detectRole();
  }, []);

  useEffect(() => {
    fetchServices();
  }, []);

  // Re-fetch when toggling inclusion of inactive services
  useEffect(() => {
    fetchServices();
  }, [showInactive]);

  // When switching tabs, ensure inactive tab loads inactive services from server
  useEffect(() => {
    if (activeTab === 'inactive') {
      // fetch explicitly including inactive
      fetchServices(true);
    } else if (activeTab === 'active') {
      // ensure we have up-to-date active list
      fetchServices(false);
    }
    // for other tabs rely on existing showInactive state
  }, [activeTab]);

  useEffect(() => {
    filterAndSortServices();
  }, [services, searchTerm, statusFilter, categoryFilter, sortBy, activeTab]);

  const fetchServices = async (includeInactiveParam?: boolean) => {
    setLoading(true);
    try {
      // include inactive services based on override param or current toggle
      const include = typeof includeInactiveParam === 'boolean' ? includeInactiveParam : showInactive;
      const url = `/api/admin/services?limit=1000${include ? '&include_inactive=1' : ''}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Échec du chargement');
      const body = await res.json();
      const data = body.data || [];
      setServices(data);
      
      // Calculate statistics
      const activeServices = data.filter((s: any) => s.is_active);
      const totalDuration = data.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
      const averagePrice = data.length > 0 
        ? data.reduce((sum: number, s: any) => sum + (s.price || 0), 0) / data.length 
        : 0;
      
      setStats({
        total: data.length,
        active: activeServices.length,
        inactive: data.length - activeServices.length,
        averagePrice: Math.round(averagePrice * 100) / 100,
        totalDuration
      });
      
      toast.success(`${data.length} services chargés`);
    } catch (e) {
      console.error(e);
      toast.error('Impossible de charger les services');
    } finally { 
      setLoading(false); 
    }
  };

  const filterAndSortServices = () => {
    let filtered = [...services];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(service => 
        statusFilter === 'active' ? service.is_active : !service.is_active
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(service => service.category === categoryFilter);
    }

    // Active tab filter
    if (activeTab !== 'all') {
      if (activeTab === 'active') {
        filtered = filtered.filter(service => service.is_active);
      } else if (activeTab === 'inactive') {
        filtered = filtered.filter(service => !service.is_active);
      } else {
        filtered = filtered.filter(service => service.category === activeTab);
      }
    }

    // Sorting
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price_asc':
          return (a.price || 0) - (b.price || 0);
        case 'price_desc':
          return (b.price || 0) - (a.price || 0);
        case 'duration_asc':
          return (a.duration_minutes || 0) - (b.duration_minutes || 0);
        case 'duration_desc':
          return (b.duration_minutes || 0) - (a.duration_minutes || 0);
        default:
          return 0;
      }
    });

    setFilteredServices(filtered);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      price: 0,
      duration_minutes: 60,
      category: 'general',
      is_active: true,
      tags: [],
      requires_approval: false,
      max_participants: 1,
      color_code: '#3b82f6'
    });
    setOpenDialog(true);
  };

  const openEdit = (service: any) => {
    setEditing(service);
    setForm({
      name: service.name || '',
      description: service.description || '',
      price: service.price || 0,
      purchase_price: service.purchase_price || 0,
      duration_minutes: service.duration_minutes || 60,
      category: service.category || 'general',
      is_active: service.is_active !== false,
      tags: service.tags || [],
      requires_approval: service.requires_approval || false,
      max_participants: service.max_participants || 1,
      color_code: service.color_code || '#3b82f6'
    });
    setOpenDialog(true);
  };

  const openDelete = (service: any) => {
    setServiceToDelete(service);
    setOpenDeleteDialog(true);
  };

  const saveService = async () => {
    if (!form.name.trim()) {
      toast.error('Le nom du service est requis');
      return;
    }
    if (form.price < 0) {
      toast.error('Le prix ne peut pas être négatif');
      return;
    }
    if (form.duration_minutes <= 0) {
      toast.error('La durée doit être supérieure à 0 minutes');
      return;
    }

    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/api/admin/services/${editing.id}` : '/api/admin/services';
      
      const payload = {
        ...form,
        price: Number(form.price),
        duration_minutes: Number(form.duration_minutes),
        max_participants: Number(form.max_participants)
      };

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Échec de la sauvegarde');
      
      toast.success(editing ? 'Service mis à jour' : 'Service créé avec succès');
      setOpenDialog(false);
      fetchServices();
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;
    
    try {
      const res = await apiFetch(`/api/admin/services/${serviceToDelete.id}`, { 
        method: 'DELETE' 
      });
      
      if (!res.ok) throw new Error('Échec de la suppression');
      
      toast.success('Service supprimé');
      setOpenDeleteDialog(false);
      setServiceToDelete(null);
      fetchServices(false);
    } catch (e) { 
      console.error(e); 
      toast.error('Impossible de supprimer le service');
    }
  };

  const toggleServiceStatus = async (service: any) => {
    try {
      const newStatus = !service.is_active;
      const res = await apiFetch(`/api/admin/services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus })
      });
      
      if (!res.ok) throw new Error('Échec de la mise à jour');
      
      toast.success(`Service ${newStatus ? 'activé' : 'désactivé'}`);
      fetchServices();
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors du changement de statut');
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h${mins > 0 ? `${mins}min` : ''}`;
    }
    return `${mins}min`;
  };

  const formatPrice = (price: number) => {
    // Format as Franc CFA (F CFA)
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(price || 0);
    return `${formatted} F CFA`;
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.icon || Tag;
  };

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.label || 'Général';
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Services</h1>
          <p className="text-gray-600 mt-1">
            Gérez et organisez vos services professionnels
          </p>
        </div>
            <div className="flex gap-2 items-center">
            <Button 
              variant="outline" 
              onClick={fetchServices}
              className="gap-2"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Rafraîchir
            </Button>

            <div className="flex items-center gap-2 px-2">
              <Switch
                checked={showInactive}
                onCheckedChange={(v) => setShowInactive(Boolean(v))}
              />
              <span className="text-sm">Afficher inactifs</span>
            </div>

            {!isEmployee && (
            <Button 
              onClick={openCreate}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nouveau Service
            </Button>
            )}
          </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Services</p>
                <h3 className="text-2xl font-bold mt-2">{stats.total}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <Tag className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Tous services confondus</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Actifs</p>
                <h3 className="text-2xl font-bold mt-2 text-green-600">{stats.active}</h3>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Services disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactifs</p>
                <h3 className="text-2xl font-bold mt-2 text-red-600">{stats.inactive}</h3>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Services désactivés</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Prix moyen</p>
                <h3 className="text-2xl font-bold mt-2 text-purple-600">
                  {formatPrice(stats.averagePrice)}
                </h3>
              </div>
              <div className="p-3 bg-purple-50 rounded-full">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Moyenne tous services</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Durée totale</p>
                <h3 className="text-2xl font-bold mt-2 text-orange-600">
                  {formatDuration(stats.totalDuration)}
                </h3>
              </div>
              <div className="p-3 bg-orange-50 rounded-full">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Cumul des durées</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle>Services disponibles</CardTitle>
              <CardDescription>
                {filteredServices.length} services trouvés
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un service..."
                  className="pl-9 w-full sm:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes catégories</SelectItem>
                    {categories.map(category => {
                      const Icon = category.icon;
                      return (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {category.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Trier par" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nom (A-Z)</SelectItem>
                    <SelectItem value="price_asc">Prix (Croissant)</SelectItem>
                    <SelectItem value="price_desc">Prix (Décroissant)</SelectItem>
                    <SelectItem value="duration_asc">Durée (Croissante)</SelectItem>
                    <SelectItem value="duration_desc">Durée (Décroissante)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
              <TabsTrigger value="all" className="data-[state=active]:bg-blue-50">
                Tous
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-green-50">
                <CheckCircle className="h-4 w-4 mr-2" />
                Actifs
              </TabsTrigger>
              <TabsTrigger value="inactive" className="data-[state=active]:bg-red-50">
                <XCircle className="h-4 w-4 mr-2" />
                Inactifs
              </TabsTrigger>
              <TabsTrigger value="premium" className="data-[state=active]:bg-yellow-50">
                <Star className="h-4 w-4 mr-2" />
                Premium
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Services Table */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Tag className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucun service trouvé
              </h3>
              <p className="text-gray-600 max-w-sm mx-auto mb-6">
                {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Aucun service ne correspond à vos critères'
                  : 'Commencez par créer votre premier service'}
              </p>
              {!isEmployee && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un service
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Service</TableHead>
                    <TableHead className="font-semibold">Catégorie</TableHead>
                    <TableHead className="font-semibold">Prix</TableHead>
                    <TableHead className="font-semibold">Durée</TableHead>
                    <TableHead className="font-semibold">Statut</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map(service => {
                    const CategoryIcon = getCategoryIcon(service.category || 'general');
                    return (
                      <TableRow key={service.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: service.color_code + '20' }}
                            >
                              <CategoryIcon 
                                className="h-5 w-5" 
                                style={{ color: service.color_code }}
                              />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {service.name}
                              </div>
                              {service.description && (
                                <div className="text-sm text-gray-500 line-clamp-1">
                                  {service.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className="border-blue-200 text-blue-700"
                          >
                            <CategoryIcon className="h-3 w-3 mr-1" />
                            {getCategoryLabel(service.category || 'general')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">
                              {formatPrice(service.price || 0)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span>{formatDuration(service.duration_minutes || 0)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={service.is_active !== false}
                              onCheckedChange={(v) => { if (!isEmployee) toggleServiceStatus(service); }}
                              className="data-[state=checked]:bg-green-500"
                              disabled={isEmployee}
                            />
                            <Badge
                              variant={service.is_active !== false ? "success" : "secondary"}
                              className={
                                service.is_active !== false 
                                  ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                              }
                            >
                              {service.is_active !== false ? 'Actif' : 'Inactif'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/services/${service.id}`)}
                              className="gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              Détails
                            </Button>
                            
                            {!isEmployee && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openEdit(service)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => toggleServiceStatus(service)}
                                >
                                  {service.is_active !== false ? (
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
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => openDelete(service)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            )}
                          </div>
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

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editing ? 'Modifier le service' : 'Nouveau service'}
            </DialogTitle>
            <DialogDescription>
              {editing 
                ? 'Modifiez les informations du service' 
                : 'Remplissez les informations pour créer un nouveau service'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom du service *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Formation React Avancée"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description détaillée du service..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Prix de vente (F CFA) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="purchase_price">Prix d'achat (F CFA)</Label>
                <div className="relative">
                  <TrendingUp className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.purchase_price}
                    onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })}
                    className="pl-9"
                    placeholder="Coût d'achat"
                  />
                </div>
                {form.purchase_price > 0 && form.price > 0 && (
                  <p className="text-xs text-teal-600 font-medium">
                    Marge : {formatCurrency(form.price - form.purchase_price)}
                    {' '}({Math.round(((form.price - form.purchase_price) / form.price) * 100)}%)
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="duration">Durée (minutes) *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {formatDuration(form.duration_minutes)}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="max_participants">Participants max</Label>
                <Input
                  id="max_participants"
                  type="number"
                  min="1"
                  value={form.max_participants}
                  onChange={(e) => setForm({ ...form, max_participants: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Catégorie</Label>
                <Select 
                  value={form.category} 
                  onValueChange={(value) => setForm({ ...form, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => {
                      const Icon = category.icon;
                      return (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {category.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="color">Couleur d'identification</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.color_code}
                    onChange={(e) => setForm({ ...form, color_code: e.target.value })}
                    className="w-10 h-10 cursor-pointer"
                  />
                  <Input
                    value={form.color_code}
                    onChange={(e) => setForm({ ...form, color_code: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Service actif
                  </Label>
                  <p className="text-sm text-gray-500">
                    Le service sera visible pour les clients
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="requires_approval" className="cursor-pointer">
                    Nécessite approbation
                  </Label>
                  <p className="text-sm text-gray-500">
                    La réservation nécessite une validation manuelle
                  </p>
                </div>
                <Switch
                  id="requires_approval"
                  checked={form.requires_approval}
                  onCheckedChange={(checked) => setForm({ ...form, requires_approval: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Annuler
            </Button>
            <Button onClick={saveService} className="min-w-32" disabled={isEmployee}>
              {editing ? 'Mettre à jour' : 'Créer le service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement le service "
              <span className="font-semibold">{serviceToDelete?.name}</span>".
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setServiceToDelete(null)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServicesPageImproved;