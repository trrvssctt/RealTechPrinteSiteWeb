import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { apiFetch } from '@/lib/api';
import { 
  Eye, 
  Download, 
  Filter, 
  Search, 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  Package,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Check,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  MapPin,
  CreditCard,
  MessageSquare,
  Printer
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Orders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    let filtered = orders;

    // Filter by search query
    if (searchQuery.trim() !== "") {
      filtered = filtered.filter(order =>
        order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Filter by date
    const now = new Date();
    if (dateFilter !== "all") {
      const startDate = new Date();
      switch (dateFilter) {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          break;
      }
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.placed_at || order.created_at);
        return orderDate >= startDate;
      });
    }

    setFilteredOrders(filtered);
    setCurrentPage(1);
  }, [orders, searchQuery, statusFilter, dateFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/orders', { 
        headers: token ? { Authorization: `Bearer ${token}` } : {} 
      });
      if (!resp.ok) throw new Error('Erreur lors du chargement des commandes');
      const payload = await resp.json();
      const sortedOrders = (payload.data || [])
        .sort((a: any, b: any) => 
          new Date(b.placed_at || b.created_at).getTime() - 
          new Date(a.placed_at || a.created_at).getTime()
        );
      setOrders(sortedOrders);
      setFilteredOrders(sortedOrders);
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors du chargement des commandes', {
        description: 'Veuillez réessayer'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (order: any) => {
    setSelectedOrder(order);
    setOrderItems(order.items || order.order_items || []);
    setNotes(order.notes || "");
    setDetailsOpen(true);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!resp.ok) throw new Error('Erreur lors de la mise à jour');
      
      toast.success('✅ Statut mis à jour', {
        description: 'La commande a été mise à jour avec succès'
      });
      
      fetchOrders();
      
      // Update selected order if it's the same
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors de la mise à jour', {
        description: 'Impossible de modifier le statut'
      });
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedOrder) return;
    
    setSavingNotes(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ notes })
      });
      
      if (!resp.ok) throw new Error('Erreur lors de la sauvegarde');
      
      toast.success('✅ Notes enregistrées', {
        description: 'Les notes ont été sauvegardées avec succès'
      });
      
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors de la sauvegarde', {
        description: 'Impossible de sauvegarder les notes'
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: any }> = {
      pending: { 
        label: "En attente", 
        color: "bg-yellow-100 text-yellow-800 border-yellow-200", 
        icon: Clock 
      },
      confirmed: { 
        label: "Confirmée", 
        color: "bg-blue-100 text-blue-800 border-blue-200", 
        icon: CheckCircle 
      },
      processing: { 
        label: "En traitement", 
        color: "bg-purple-100 text-purple-800 border-purple-200", 
        icon: Package 
      },
      shipping: { 
        label: "En livraison", 
        color: "bg-indigo-100 text-indigo-800 border-indigo-200", 
        icon: Truck 
      },
      completed: { 
        label: "Terminée", 
        color: "bg-green-100 text-green-800 border-green-200", 
        icon: Check 
      },
      cancelled: { 
        label: "Annulée", 
        color: "bg-red-100 text-red-800 border-red-200", 
        icon: XCircle 
      }
    };
    return configs[status] || { 
      label: status, 
      color: "bg-gray-100 text-gray-800 border-gray-200", 
      icon: ShoppingCart 
    };
  };

  const calculateTotals = useMemo(() => {
    const total = orders.length;
    const revenue = orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
    const pending = orders.filter(o => o.status === 'pending').length;
    const completed = orders.filter(o => o.status === 'completed').length;
    
    return { total, revenue, pending, completed };
  }, [orders]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  const formatDateTime = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return format(date, "dd MMM yyyy 'à' HH:mm", { locale: fr });
    } catch {
      return "Date invalide";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={`${config.color} gap-1 border`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const exportOrder = (order: any) => {
    toast.info("📄 Export en cours...", {
      description: "La fonctionnalité d'export sera disponible prochainement"
    });
  };

  const printOrder = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Commande ${order.order_number}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .section { margin-bottom: 20px; }
              .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Facture Commande #${order.order_number}</h1>
              <p>Date: ${formatDateTime(order.placed_at || order.created_at)}</p>
            </div>
            <div class="section">
              <h3>Client</h3>
              <p>${order.customer_name || 'N/A'}</p>
              <p>${order.customer_phone || ''}</p>
              <p>${order.customer_email || ''}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Quantité</th>
                  <th>Prix unitaire</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${(order.items || order.order_items || []).map((item: any) => `
                  <tr>
                    <td>${item.product_name || 'Produit'}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.unit_price || 0)}</td>
                    <td>${formatCurrency(item.total_price || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="total">
              Total: ${formatCurrency(order.total_amount || 0)}
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(() => window.close(), 1000);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gestion des Commandes</h1>
              <p className="text-muted-foreground mt-1">
                Gérez et suivez toutes les commandes de vos clients
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Commandes</p>
                <p className="text-3xl font-bold">{calculateTotals.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Chiffre d'affaires</p>
                <p className="text-3xl font-bold">{formatCurrency(calculateTotals.revenue)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En attente</p>
                <p className="text-3xl font-bold">{calculateTotals.pending}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Terminées</p>
                <p className="text-3xl font-bold">{calculateTotals.completed}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-emerald-600" />
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
                placeholder="Rechercher une commande (numéro, client, téléphone...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-11">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmée</SelectItem>
                  <SelectItem value="processing">En traitement</SelectItem>
                  <SelectItem value="shipping">En livraison</SelectItem>
                  <SelectItem value="completed">Terminée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[160px] h-11">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toute période</SelectItem>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="week">7 derniers jours</SelectItem>
                  <SelectItem value="month">30 derniers jours</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={fetchOrders}
                className="h-11 w-11"
                disabled={loading}
              >
                <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des commandes</CardTitle>
          <CardDescription>
            {filteredOrders.length} commande{filteredOrders.length !== 1 ? 's' : ''} trouvée{filteredOrders.length !== 1 ? 's' : ''}
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
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Aucune commande trouvée</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all" || dateFilter !== "all" 
                  ? 'Aucune commande ne correspond à vos critères'
                  : 'Aucune commande n\'a été passée pour le moment'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commande</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="font-medium">#{order.order_number || order.id.substring(0, 8)}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {orderItems.length || 0} article{order.items?.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.customer_name || 'Client'}</div>
                            <div className="text-sm text-muted-foreground">{order.customer_phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold">{formatCurrency(order.total_amount)}</div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={order.status}
                            onValueChange={(value) => handleStatusChange(order.id, value)}
                          >
                            <SelectTrigger className="w-36">
                              <StatusBadge status={order.status} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  En attente
                                </div>
                              </SelectItem>
                              <SelectItem value="confirmed">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4" />
                                  Confirmée
                                </div>
                              </SelectItem>
                              <SelectItem value="processing">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4" />
                                  En traitement
                                </div>
                              </SelectItem>
                              <SelectItem value="shipping">
                                <div className="flex items-center gap-2">
                                  <Truck className="h-4 w-4" />
                                  En livraison
                                </div>
                              </SelectItem>
                              <SelectItem value="completed">
                                <div className="flex items-center gap-2">
                                  <Check className="h-4 w-4" />
                                  Terminée
                                </div>
                              </SelectItem>
                              <SelectItem value="cancelled">
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-4 w-4" />
                                  Annulée
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDateTime(order.placed_at || order.created_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(order)}
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
                                <DropdownMenuItem onClick={() => handleViewDetails(order)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Voir les détails
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => printOrder(order)}>
                                  <Printer className="mr-2 h-4 w-4" />
                                  Imprimer la commande
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportOrder(order)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Exporter en PDF
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {order.status !== 'completed' && order.status !== 'cancelled' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'completed')}>
                                    <Check className="mr-2 h-4 w-4" />
                                    Marquer comme terminée
                                  </DropdownMenuItem>
                                )}
                                {order.status !== 'cancelled' && (
                                  <DropdownMenuItem 
                                    onClick={() => handleStatusChange(order.id, 'cancelled')}
                                    className="text-destructive"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Annuler la commande
                                  </DropdownMenuItem>
                                )}
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
                    Affichage de {startIndex + 1} à {Math.min(endIndex, filteredOrders.length)} sur {filteredOrders.length} commandes
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

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Commande #{selectedOrder.order_number || selectedOrder.id.substring(0, 8)}
                </DialogTitle>
                <DialogDescription>
                  Passée le {formatDateTime(selectedOrder.placed_at || selectedOrder.created_at)}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Aperçu</TabsTrigger>
                  <TabsTrigger value="products">Produits</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Customer Info */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Informations client
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{selectedOrder.customer_name || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{selectedOrder.customer_phone || 'N/A'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{selectedOrder.customer_email || 'N/A'}</p>
                        </div>
                        {selectedOrder.metadata?.shipping_address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <p className="text-sm">{selectedOrder.metadata.shipping_address}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Order Info */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Informations commande
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Statut</span>
                          <StatusBadge status={selectedOrder.status} />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Date</span>
                          <span className="text-sm font-medium">
                            {formatDateTime(selectedOrder.placed_at || selectedOrder.created_at)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Méthode de paiement</span>
                          <span className="text-sm font-medium">
                            {selectedOrder.payment_method || 'Non spécifié'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">ID Transaction</span>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {selectedOrder.transaction_id || 'N/A'}
                          </code>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Status Timeline */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Suivi de commande</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          { status: 'pending', label: 'Commande reçue', time: selectedOrder.created_at },
                          { status: 'confirmed', label: 'Commande confirmée', time: selectedOrder.confirmed_at },
                          { status: 'processing', label: 'En préparation', time: selectedOrder.processing_at },
                          { status: 'shipping', label: 'En livraison', time: selectedOrder.shipping_at },
                          { status: 'completed', label: 'Livrée', time: selectedOrder.completed_at }
                        ].map((step, index) => {
                          const isActive = selectedOrder.status === step.status;
                          const isPast = ['pending', 'confirmed', 'processing', 'shipping', 'completed']
                            .indexOf(selectedOrder.status) >= 
                            ['pending', 'confirmed', 'processing', 'shipping', 'completed']
                            .indexOf(step.status);
                          
                          return (
                            <div key={step.status} className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                isPast ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {isPast ? <Check className="h-4 w-4" /> : index + 1}
                              </div>
                              <div className="flex-1">
                                <p className={`font-medium ${isPast ? 'text-green-700' : 'text-gray-500'}`}>
                                  {step.label}
                                </p>
                                {step.time && (
                                  <p className="text-xs text-muted-foreground">
                                    {formatDateTime(step.time)}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="products">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Produits commandés</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produit</TableHead>
                            <TableHead>Quantité</TableHead>
                            <TableHead>Prix unitaire</TableHead>
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="font-medium">{item.product_name || 'Produit'}</div>
                                {item.product_id && (
                                  <div className="text-xs text-muted-foreground">
                                    SKU: {item.sku || 'N/A'}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>{formatCurrency(item.unit_price || 0)}</TableCell>
                              <TableCell>{formatCurrency(item.total_price || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      <div className="flex justify-end border-t pt-4 mt-4">
                        <div className="text-right space-y-2">
                          <div className="flex items-center justify-between gap-8">
                            <span className="text-sm text-muted-foreground">Sous-total</span>
                            <span className="font-medium">
                              {formatCurrency(selectedOrder.subtotal || selectedOrder.total_amount)}
                            </span>
                          </div>
                          {selectedOrder.shipping_fee && (
                            <div className="flex items-center justify-between gap-8">
                              <span className="text-sm text-muted-foreground">Livraison</span>
                              <span className="font-medium">
                                {formatCurrency(selectedOrder.shipping_fee)}
                              </span>
                            </div>
                          )}
                          {selectedOrder.tax_amount && (
                            <div className="flex items-center justify-between gap-8">
                              <span className="text-sm text-muted-foreground">Taxes</span>
                              <span className="font-medium">
                                {formatCurrency(selectedOrder.tax_amount)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-8 border-t pt-2">
                            <span className="text-lg font-bold">Total</span>
                            <span className="text-2xl font-bold text-primary">
                              {formatCurrency(selectedOrder.total_amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notes">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Notes internes
                      </CardTitle>
                      <CardDescription>
                        Ajoutez des notes pour le suivi de cette commande
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <Textarea
                          placeholder="Ajoutez des notes sur cette commande..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={6}
                          className="resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setNotes(selectedOrder.notes || "")}
                          >
                            Annuler
                          </Button>
                          <Button
                            onClick={handleSaveNotes}
                            disabled={savingNotes}
                          >
                            {savingNotes ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Enregistrement...
                              </>
                            ) : (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Enregistrer les notes
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    onClick={() => printOrder(selectedOrder)}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimer
                  </Button>
                  <Button
                    onClick={() => exportOrder(selectedOrder)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exporter
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;