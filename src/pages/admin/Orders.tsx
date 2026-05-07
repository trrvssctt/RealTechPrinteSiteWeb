import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { useUser } from '@/hooks/useUser';
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
  ,
  RotateCcw,
  Plus,
  UserPlus,
  Building,
  Trash2,
  Minus,
  X,
  TrendingUp,
} from "lucide-react";

import { format, parseISO } from "date-fns";
import { useAdmin } from '@/hooks/useAdmin';
import logo_realtech from '/assets/logo_realtech.png';
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
  const [saleTypeFilter, setSaleTypeFilter] = useState<string>("all");
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Create order modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [newOrderItemsLocal, setNewOrderItemsLocal] = useState<any[]>([]);
  const [orderClient, setOrderClient] = useState<any>(null);
  const [productSearch, setProductSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [showServices, setShowServices] = useState<boolean>(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('card');
  const [shippingMethod, setShippingMethod] = useState<string>('standard');

  const [orderNotes, setOrderNotes] = useState<string>('');
  // Sale type: 'order' = commande classique, 'direct_sale' = vente directe encaissée
  const [saleType, setSaleType] = useState<'order' | 'direct_sale'>('order');
  // Mobile tab in create modal
  const [createTab, setCreateTab] = useState<'catalogue' | 'panier'>('catalogue');
  const navigate = useNavigate();
  const { user: currentUser } = useUser();

  const isEmployee = (() => {
    const raw = currentUser?.roles || [];
    const roles: string[] = Array.isArray(raw) ? raw.map((r:any) => (r||'').toString().toLowerCase()) : [];
    return roles.includes('employee') || roles.includes('employe') || roles.includes('employé') || roles.includes('staff');
  })();
  const [orderClientRecord, setOrderClientRecord] = useState<any>(null);
  // Cancel modal state
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelReturnMode, setCancelReturnMode] = useState<'none' | 'full' | 'partial'>('full');
  const [cancelReturnedQtys, setCancelReturnedQtys] = useState<Record<string, number>>({});

  // Complete-order dialog
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completePayment, setCompletePayment] = useState<'paid' | 'unpaid'>('paid');
  const [completeDelivery, setCompleteDelivery] = useState<'full' | 'partial' | 'none'>('full');
  const [completeDeliveredQtys, setCompleteDeliveredQtys] = useState<Record<string, number>>({});
  const [completing, setCompleting] = useState(false);

  const getProductStock = (productId: string) => {
    const prod = availableProducts.find(p => p.id === productId);
    if (prod) return Number(prod.stock || 0);
    const it = newOrderItemsLocal.find((i: any) => i.product_id === productId);
    return Number(it?.stock || 0) || 0;
  };

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

    // Filter by sale type
    if (saleTypeFilter !== "all") {
      filtered = filtered.filter(order => {
        const st = order.metadata?.sale_context?.sale_type || 'order';
        return st === saleTypeFilter;
      });
    }

    setFilteredOrders(filtered);
    setCurrentPage(1);
  }, [orders, searchQuery, statusFilter, dateFilter, saleTypeFilter]);

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
      // Try to enrich each order with a linked client record (if available)
      try {
        const token = localStorage.getItem('sessionToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const enriched = await Promise.all(sortedOrders.map(async (o: any) => {
          try {
            if (o.client_id) {
              const r = await apiFetch(`/api/admin/clients/${o.client_id}`, { headers });
              if (r.ok) {
                const pl = await r.json().catch(() => ({}));
                const client = pl.client || pl.data || pl;
                o.client_record = Array.isArray(client) ? client[0] : client;
                return o;
              }
            }
            if (o.customer_email) {
              const r = await apiFetch(`/api/admin/clients?email=${encodeURIComponent(o.customer_email)}`, { headers });
              if (r.ok) {
                const pl = await r.json().catch(() => ({}));
                o.client_record = (pl.data && pl.data[0]) || null;
              }
            }
          } catch (e) {
            console.error('Failed to enrich order with client', e);
          }
          return o;
        }));
        setOrders(enriched);
        setFilteredOrders(enriched);
      } catch (e) {
        // fallback to basic list on any error
        setOrders(sortedOrders);
        setFilteredOrders(sortedOrders);
      }
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
    // If the order was enriched with a client_record during fetchOrders, use it immediately
    if (order.client_record) {
      setOrderClientRecord(order.client_record);
    } else {
      fetchClientRecord(order);
    }
  };

  const fetchClientRecord = async (order: any) => {
    setOrderClientRecord(null);
    try {
      const token = localStorage.getItem('sessionToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (order.client_id) {
        const resp = await apiFetch(`/api/admin/clients/${order.client_id}`, { headers });
        if (!resp.ok) return;
        const payload = await resp.json().catch(() => ({}));
        // support multiple payload shapes
        const client = payload.client || payload.data || payload;
        // if data is array, take first
        setOrderClientRecord(Array.isArray(client) ? client[0] : client);
        return;
      }

      if (order.customer_email) {
        const resp = await apiFetch(`/api/admin/clients?email=${encodeURIComponent(order.customer_email)}`, { headers });
        if (!resp.ok) return;
        const payload = await resp.json().catch(() => ({}));
        setOrderClientRecord((payload.data && payload.data[0]) || null);
        return;
      }
    } catch (err) {
      console.error('Failed to fetch client record', err);
    }
  };

  useEffect(() => {
    if (!detailsOpen) setOrderClientRecord(null);
  }, [detailsOpen]);

  // Open the complete dialog pre-filled with item quantities
  const openCompleteDialog = (order: any) => {
    setSelectedOrder(order);
    // Pre-fill from existing delivery metadata for in_progress orders
    const prevDelivery = order.metadata?.delivery;
    setCompletePayment((prevDelivery?.payment_status as 'paid' | 'unpaid') || 'paid');
    setCompleteDelivery((prevDelivery?.delivery_status as 'full' | 'partial' | 'none') || 'full');
    const qtys: Record<string, number> = {};
    if (prevDelivery?.delivered_items?.length > 0) {
      prevDelivery.delivered_items.forEach((it: any) => {
        if (it.product_id) qtys[it.product_id] = Number(it.delivered_qty || 0);
      });
    } else {
      (order.items || []).forEach((it: any) => {
        if (it.product_id) qtys[it.product_id] = Number(it.quantity || 0);
      });
    }
    setCompleteDeliveredQtys(qtys);
    setCompleteOpen(true);
  };

  // Open the cancel dialog
  const openCancelDialog = (order: any) => {
    setSelectedOrder(order);
    setCancelReason('');
    // If the order was completed/in_progress with deliveries, default to full return
    const hadDelivery = (order.status === 'completed' || order.status === 'in_progress') &&
      order.metadata?.delivery?.delivery_status !== 'none';
    setCancelReturnMode(hadDelivery ? 'full' : 'none');
    const qtys: Record<string, number> = {};
    (order.metadata?.delivery?.delivered_items || order.items || []).forEach((it: any) => {
      const pid = it.product_id;
      const qty = it.delivered_qty ?? Number(it.quantity || 0);
      if (pid) qtys[pid] = qty;
    });
    setCancelReturnedQtys(qtys);
    setCancelOpen(true);
  };

  // Submit completion
  const handleCompleteOrder = async () => {
    if (!selectedOrder) return;
    setCompleting(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const body: any = {
        status: 'completed',
        delivery_status: completeDelivery,
        payment_status: completePayment,
      };
      if (completeDelivery === 'partial') {
        body.delivered_items = Object.entries(completeDeliveredQtys)
          .filter(([, qty]) => qty > 0)
          .map(([product_id, quantity]) => ({ product_id, quantity }));
      }
      const resp = await apiFetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la finalisation');
      }
      toast.success('✅ Commande finalisée');
      setCompleteOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error('❌ ' + (err.message || 'Erreur'));
    } finally {
      setCompleting(false);
    }
  };

  // Submit cancellation with return info
  const handleCancelWithReturn = async () => {
    if (!selectedOrder) return;
    setCancelling(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const body: any = { status: 'cancelled', cancel_reason: cancelReason || null };

      const hadDelivery = (selectedOrder.status === 'completed' || selectedOrder.status === 'in_progress') &&
        selectedOrder.metadata?.delivery?.delivery_status !== 'none';

      if (hadDelivery) {
        if (cancelReturnMode === 'none') {
          body.returned_items = []; // explicit empty = no stock restore
        } else if (cancelReturnMode === 'full') {
          // return everything that was delivered
          const delivered = selectedOrder.metadata?.delivery?.delivered_items || selectedOrder.items || [];
          body.returned_items = delivered
            .filter((it: any) => it.product_id)
            .map((it: any) => ({
              product_id: it.product_id,
              quantity: it.delivered_qty ?? Number(it.quantity || 0),
            }));
        } else {
          body.returned_items = Object.entries(cancelReturnedQtys)
            .filter(([, qty]) => qty > 0)
            .map(([product_id, quantity]) => ({ product_id, quantity }));
        }
      }

      const resp = await apiFetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de l\'annulation');
      }
      toast.success('✅ Commande annulée');
      setCancelOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error('❌ ' + (err.message || 'Erreur'));
    } finally {
      setCancelling(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string, cancelReasonParam?: string) => {
    // Intercept completion to show the delivery/payment dialog
    if (newStatus === 'completed') {
      const order = orders.find(o => o.id === orderId) || selectedOrder;
      if (order) { openCompleteDialog(order); return; }
    }

    try {
      const token = localStorage.getItem('sessionToken');
      let body: any = { status: newStatus };

      // if cancelling, use provided reason or fallback to prompt
      if (newStatus === 'cancelled') {
        if (typeof cancelReasonParam !== 'undefined') {
          body.cancel_reason = cancelReasonParam || null;
        } else {
          const reason = window.prompt('Motif de l\'annulation (facultatif)');
          if (reason !== null) body.cancel_reason = reason;
        }
      }

      const resp = await apiFetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la mise à jour');
      }

      const payload = await resp.json().catch(() => ({}));
      const updated = payload.data || null;

      toast.success('✅ Statut mis à jour', { description: 'La commande a été mise à jour avec succès' });
      fetchOrders();

      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated || { ...selectedOrder, status: newStatus });
        setOrderItems((updated && (updated.items || [])) || orderItems);
      }

      // If order has just been completed, update local stocks (no auto-export/print)
      if (newStatus === 'completed' && updated) {
        // Note: removed automatic invoice/export to avoid opening print/download UI.
        // Optimistically update local product stocks so UI reflects changes immediately
        try {
          const items = updated.items || updated.order_items || [];
          if (availableProducts && availableProducts.length > 0 && items.length > 0) {
            setAvailableProducts(prev => {
              const map = new Map(prev.map(p => [p.id, { ...p }]));
              items.forEach((it: any) => {
                if (!it.product_id) return;
                const prod = map.get(it.product_id);
                if (prod) {
                  prod.stock = Math.max(0, Number(prod.stock || 0) - Number(it.quantity || 0));
                  map.set(it.product_id, prod);
                }
              });
              return Array.from(map.values());
            });

            setFilteredProducts(prev => prev.map(p => {
              const it = items.find((x: any) => x.product_id === p.id);
              if (!it) return p;
              return { ...p, stock: Math.max(0, Number(p.stock || 0) - Number(it.quantity || 0)) };
            }));
          }
        } catch (e) {
          console.error('Failed to update local stocks after completion', e);
        }
      }

      // If order has just been cancelled and we cancelled a previously completed order, optimistically restore local stocks
      if (newStatus === 'cancelled' && updated) {
        try {
          // if the selectedOrder we had locally was completed before cancellation, restore stocks
          const wasCompleted = selectedOrder && selectedOrder.id === orderId && selectedOrder.status === 'completed';
          const items = (updated.items || updated.order_items || []);
          if (wasCompleted && items.length > 0 && availableProducts && availableProducts.length > 0) {
            setAvailableProducts(prev => {
              const map = new Map(prev.map(p => [p.id, { ...p }]));
              items.forEach((it: any) => {
                if (!it.product_id) return;
                const prod = map.get(it.product_id);
                if (prod) {
                  prod.stock = Number(prod.stock || 0) + Number(it.quantity || 0);
                  map.set(it.product_id, prod);
                }
              });
              return Array.from(map.values());
            });

            setFilteredProducts(prev => prev.map(p => {
              const it = items.find((x: any) => x.product_id === p.id);
              if (!it) return p;
              return { ...p, stock: Number(p.stock || 0) + Number(it.quantity || 0) };
            }));
          }
        } catch (e) {
          console.error('Failed to update local stocks after cancellation', e);
        }
      }

      return updated;
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur lors de la mise à jour', { description: (err && err.message) || 'Impossible de modifier le statut' });
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
      in_progress: {
        label: "En cours",
        color: "bg-blue-100 text-blue-800 border-blue-200",
        icon: Loader2,
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
    const completedOrders = orders.filter(o => o.status === 'completed');
    const revenue = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const gainReel = completedOrders.reduce((sum, o) => {
      const real = Number(o.total_amount) || 0;
      const cost = Number(o.cost_amount) || 0;
      return sum + (real - cost);
    }, 0);
    const gainEstime = completedOrders.reduce((sum, o) => {
      const cat  = Number(o.catalog_amount) || 0;
      const cost = Number(o.cost_amount) || 0;
      return sum + (cat - cost);
    }, 0);
    const pending     = orders.filter(o => o.status === 'pending').length;
    const in_progress = orders.filter(o => o.status === 'in_progress').length;
    const completed   = completedOrders.length;

    return { total, revenue, gainReel, gainEstime, pending, in_progress, completed };
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

  const fetchProducts = async () => {
    try {
      const resp = await apiFetch('/api/products?limit=1000');
      if (!resp.ok) return;
      const payload = await resp.json();
      setAvailableProducts(payload.data || []);
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/services?limit=1000', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) return;
      const payload = await resp.json().catch(() => ({}));
      setAvailableServices(payload.data || payload || []);
    } catch (err) {
      console.error('Failed to load services', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const resp = await apiFetch('/api/categories');
      if (!resp.ok) return;
      const payload = await resp.json();
      setCategories(payload.data || []);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  // recompute filteredProducts when products, search or category filter change
  useEffect(() => {
    let list = availableProducts || [];
    if (productCategoryFilter && productCategoryFilter !== 'all') {
      list = list.filter(p => p.category && p.category.id === productCategoryFilter);
    }
    if (productSearch && productSearch.trim() !== '') {
      const q = productSearch.toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.category?.name || '').toLowerCase().includes(q));
    }
    setFilteredProducts(list);
  }, [availableProducts, productSearch, productCategoryFilter]);

  // recompute filteredServices when services or search changes
  useEffect(() => {
    let list = availableServices || [];
    if (serviceSearch && serviceSearch.trim() !== '') {
      const q = serviceSearch.toLowerCase();
      list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
    }
    setFilteredServices(list);
  }, [availableServices, serviceSearch]);

  const fetchClientsForPicker = async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/clients?limit=1000', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) return;
      const payload = await resp.json();
      setAvailableClients(payload.data || []);
    } catch (err) {
      console.error('Failed to load clients', err);
    }
  };

  // recompute filtered clients when availableClients or search changes
  useEffect(() => {
    let list = availableClients || [];
    if (clientSearch && clientSearch.trim() !== '') {
      const q = clientSearch.toLowerCase();
      list = list.filter(c => (c.full_name || c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').includes(q));
    }
    setFilteredClients(list);
  }, [availableClients, clientSearch]);

  const openCreateModal = (type: 'order' | 'direct_sale' = 'order') => {
    setSaleType(type);
    setCreateTab('catalogue');
    setCreateOpen(true);
    setNewOrderItemsLocal([]);
    setOrderClient(null);
    setDiscount(0);
    setPaymentMethod('cash');
    setOrderNotes('');
    fetchProducts();
    fetchClientsForPicker();
    fetchCategories();
    fetchServices();
  };

  const addProductToOrder = (p: any) => {
    const existing = newOrderItemsLocal.find(i => i.product_id === p.id);
    if (existing) {
      // increment but cap at stock
      const max = Number(p.stock || 0);
      existing.quantity = Math.min(max, (existing.quantity || 0) + 1);
      setNewOrderItemsLocal([...newOrderItemsLocal]);
      return;
    }
    setNewOrderItemsLocal([...newOrderItemsLocal, {
      product_id: p.id,
      product_name: p.name,
      catalog_price: Number(p.price || 0),
      unit_price: Number(p.price || 0),       // prix réel de vente (modifiable)
      purchase_price: Number(p.purchase_price || 0),
      quantity: 1,
      stock: Number(p.stock || 0)
    }]);
  };

  const addServiceToOrder = (s: any) => {
    const existing = newOrderItemsLocal.find(i => i.service_id === s.id);
    if (existing) {
      existing.quantity = (existing.quantity || 0) + 1;
      setNewOrderItemsLocal([...newOrderItemsLocal]);
      return;
    }
    setNewOrderItemsLocal([...newOrderItemsLocal, {
      service_id: s.id,
      service_name: s.name,
      catalog_price: Number(s.price || 0),
      unit_price: Number(s.price || 0),
      purchase_price: Number(s.purchase_price || 0),
      quantity: 1
    }]);
  };

  const updateItemQuantity = (id: string, qty: number) => {
    setNewOrderItemsLocal(prev => prev.map(i => {
      if (i.product_id === id) return { ...i, quantity: Math.max(1, Math.min(i.stock || 0, qty)) };
      if (i.service_id === id) return { ...i, quantity: Math.max(1, qty) };
      return i;
    }));
  };

  const removeItem = (id: string) => setNewOrderItemsLocal(prev => prev.filter(i => i.product_id !== id && i.service_id !== id));

  const updateItemRealPrice = (id: string, price: number) => {
    setNewOrderItemsLocal(prev => prev.map(i => {
      if (i.product_id === id || i.service_id === id) return { ...i, unit_price: Math.max(0, price) };
      return i;
    }));
  };

  // Prix réel total (prix négociés × qtés)
  const totalAmount = useMemo(() => {
    return newOrderItemsLocal.reduce((s, it) => s + (Number(it.unit_price || 0) * Number(it.quantity || 0)), 0);
  }, [newOrderItemsLocal]);

  // Prix catalogue total
  const catalogTotal = useMemo(() => {
    return newOrderItemsLocal.reduce((s, it) => s + (Number(it.catalog_price || it.unit_price || 0) * Number(it.quantity || 0)), 0);
  }, [newOrderItemsLocal]);

  // Coût total (prix d'achat × qtés)
  const costTotal = useMemo(() => {
    return newOrderItemsLocal.reduce((s, it) => s + (Number(it.purchase_price || 0) * Number(it.quantity || 0)), 0);
  }, [newOrderItemsLocal]);

  const onlyServices = useMemo(() => {
    return newOrderItemsLocal.length > 0 && newOrderItemsLocal.every(i => !!i.service_id && !i.product_id);
  }, [newOrderItemsLocal]);

  const createOrderFromModal = async () => {
    if (newOrderItemsLocal.length === 0) {
      toast.warning('Ajoutez au moins un produit ou service');
      return;
    }
    // Pour une commande classique avec produits (non service), un client est requis
    if (saleType === 'order' && !onlyServices && !orderClient) {
      toast.warning('Sélectionnez un client pour cette commande');
      return;
    }
    if (saleType === 'direct_sale' && !paymentMethod) {
      toast.warning('Sélectionnez un mode de paiement');
      return;
    }

    setSavingOrder(true);
    try {
      const finalTotal = Math.max(0, totalAmount - (discount || 0));
      const payload: any = {
        sale_type:      saleType,
        initial_status: saleType === 'direct_sale' ? 'completed' : 'pending',
        payment_method: paymentMethod,
        discount:       discount || 0,
        notes:          orderNotes || null,
        items: newOrderItemsLocal.map((it: any) => {
          const base = {
            catalog_price:  it.catalog_price  || it.unit_price || 0,
            unit_price:     it.unit_price      || 0,
            purchase_price: it.purchase_price  || 0,
            quantity:       it.quantity,
          };
          if (it.service_id) return { ...base, service_id: it.service_id, service_name: it.service_name };
          return { ...base, product_id: it.product_id, product_name: it.product_name };
        }),
        total_amount:   finalTotal,
        catalog_amount: catalogTotal,
        cost_amount:    costTotal,
        metadata: { admin_created: true, sale_type: saleType },
      };

      if (orderClient) {
        payload.client_id      = orderClient.id;
        payload.customer_name  = orderClient.full_name || orderClient.name || null;
        payload.customer_email = orderClient.email || null;
        payload.customer_phone = orderClient.phone || null;
      }

      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error('Erreur: ' + (err.error || resp.statusText));
        return;
      }
      const label = saleType === 'direct_sale' ? 'Vente directe encaissée' : 'Commande créée';
      toast.success(`✅ ${label} avec succès`);
      setCreateOpen(false);
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création');
    } finally {
      setSavingOrder(false);
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
  try {
    // Données de l'entreprise (à personnaliser)
    const companyInfo = {
      name: "Realtech Solutions",
      address: "123 Avenue des Champs-Élysées",
      city: "75008 Paris, France",
      phone: "+33 1 23 45 67 89",
      email: "contact@realtech.fr",
      website: "www.realtech.fr",
      siret: "123 456 789 00012",
      vatNumber: "FR12345678901",
      logo: '/assets/logo_realtech.png'
    };

    // Données du vendeur (peut être dynamique)
    const sellerInfo = {
      name: "Marie Martin",
      email: "marie.martin@realtech.fr",
      phone: "+33 6 12 34 56 78",
      department: "Service Commercial"
    };

    // Formattage des dates
    const invoiceDate = formatDate(order.placed_at || order.created_at);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // Échéance 30 jours
    
    // Calcul des totaux
    const subtotal = order.total_amount || (order.items || order.order_items || []).reduce((sum: number, item: any) => 
      sum + (item.total_price || (Number(item.unit_price || 0) * Number(item.quantity || 0))), 0);
    
    const taxRate = 0.20; // TVA 20%
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    const html = `<!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Facture ${order.order_number || order.id}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1f2937;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 40px 20px;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          
          .invoice-container {
            max-width: 210mm;
            min-height: 297mm;
            background: white;
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            overflow: hidden;
            position: relative;
          }
          
          /* En-tête avec dégradé */
          .invoice-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            position: relative;
            overflow: hidden;
          }
          
          .invoice-header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
            background-size: 30px 30px;
            opacity: 0.1;
          }
          
          .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
            z-index: 1;
          }
          
          .company-logo {
            display: flex;
            align-items: center;
            gap: 20px;
          }
          
          .logo-img {
            width: 150px;
            height: auto;
            filter: brightness(0) invert(1);
          }
          
          .company-name {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          
          .invoice-title {
            text-align: right;
          }
          
          .invoice-title h1 {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 10px;
          }
          
          .invoice-title p {
            font-size: 16px;
            opacity: 0.9;
          }
          
          /* Corps de la facture */
          .invoice-body {
            padding: 40px;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .info-section h3 {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #6b7280;
            margin-bottom: 15px;
            font-weight: 600;
          }
          
          .info-content {
            background: #f9fafb;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
          }
          
          .info-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
          }
          
          .info-label {
            color: #6b7280;
            font-weight: 500;
          }
          
          .info-value {
            font-weight: 600;
            color: #1f2937;
            text-align: right;
            /* Allow very long order numbers or identifiers to wrap nicely */
            overflow-wrap: anywhere;
            word-break: break-all;
            display: inline-block;
            max-width: 220px;
          }
          
          /* Tableau des articles */
          .items-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin: 40px 0;
            overflow: hidden;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          
          .items-table thead {
            background: aquamarine;
            color: white;
          }
          
          .items-table th {
            padding: 18px 20px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .items-table tbody tr {
            transition: background 0.2s;
          }
          
          .items-table tbody tr:nth-child(even) {
            background: #f9fafb;
          }
          
          .items-table tbody tr:hover {
            background: #f3f4f6;
          }
          
          .items-table td {
            padding: 16px 20px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
          }
          
          .product-name {
            font-weight: 500;
            color: #1f2937;
          }
          
          .quantity-cell {
            text-align: center;
          }
          
          .price-cell, .total-cell {
            text-align: right;
            font-family: 'Courier New', monospace;
            font-weight: 600;
          }
          
          /* Totaux */
          .totals-section {
            background: #f9fafb;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            margin-top: 40px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .total-row:last-child {
            border-bottom: none;
            font-size: 18px;
            font-weight: 700;
            color: #1f2937;
            padding-top: 20px;
          }
          
          .total-label {
            font-size: 14px;
            color: #6b7280;
          }
          
          .total-amount {
            font-family: 'Courier New', monospace;
            font-weight: 600;
            font-size: 16px;
          }
          
          .grand-total {
            font-size: 22px !important;
            color: #059669 !important;
          }
          
          /* Pied de page */
          .invoice-footer {
            padding: 40px;
            background: #f9fafb;
            border-top: 2px solid #e5e7eb;
          }
          
          .payment-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          
          .payment-method {
            background: white;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
          }
          
          .payment-method h4 {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 10px;
            font-weight: 600;
          }
          
          .bank-details {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.6;
          }
          
          .terms {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            line-height: 1.6;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          
          /* Éléments décoratifs */
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            font-weight: 900;
            color: rgba(59, 130, 246, 0.05);
            pointer-events: none;
            white-space: nowrap;
            z-index: 0;
          }
          
          .badge {
            display: inline-block;
            padding: 4px 12px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
          }
          
          /* Responsive */
          @media print {
            body {
              background: none;
              padding: 0;
            }
            
            .invoice-container {
              box-shadow: none;
              border-radius: 0;
              max-width: 100%;
            }
            
            .invoice-header {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .badge {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          
          @media screen and (max-width: 768px) {
            body {
              padding: 20px 10px;
            }
            
            .invoice-header {
              padding: 30px 20px;
            }
            
            .header-content {
              flex-direction: column;
              text-align: center;
              gap: 20px;
            }
            
            .company-logo {
              justify-content: center;
            }
            
            .invoice-title {
              text-align: center;
            }
            
            .invoice-body {
              padding: 30px 20px;
            }
            
            .info-grid {
              grid-template-columns: 1fr;
            }
            
            .items-table {
              font-size: 12px;
            }
            
            .items-table th,
            .items-table td {
              padding: 12px 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Filigrane -->
          <div class="watermark">FACTURE</div>
          
          <!-- En-tête -->
          <div class="invoice-header">
            <div class="header-content">
              <div class="company-logo">
                <img src="${logo_realtech}" alt="${companyInfo.name}" class="logo-img">
                <div class="company-name">RealTech Holding</div>
              </div>
              <div class="invoice-title">
                <h1>FACTURE</h1>
                <p>${order.order_number || `INV-${order.id.substring(0,8).toUpperCase()}`}</p>
              </div>
            </div>
          </div>
          
          <!-- Corps de la facture -->
          <div class="invoice-body">
            <!-- Informations -->
            <div class="info-grid">
              <!-- Entreprise -->
              <div class="info-section">
                <h3>Émetteur</h3>
                <div class="info-content">
                  <div class="info-item">
                    <span class="info-label">Société:</span>
                    <span class="info-value">RealTech Holding</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Adresse:</span>
                    <span class="info-value">Ouakam Cité Avion</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Téléphone:</span>
                    <span class="info-value">+221 77 422 03 20</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">sidydiop.boss@realtechprint.com</span>
                  </div>
                </div>
              </div>
              
              <!-- Client -->
              <div class="info-section">
                <h3>Client</h3>
                <div class="info-content">
                  <div class="info-item">
                    <span class="info-label">Nom:</span>
                    <span class="info-value">${order.client_record?.full_name || order.customer_name || 'Client'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${order.client_record?.email || order.customer_email || ''}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Téléphone:</span>
                    <span class="info-value">${order.client_record?.phone || order.customer_phone || ''}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">N° Commande:</span>
                    <span class="info-value">${order.order_number || order.id}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Tableau des articles -->
            <table class="items-table">
              <thead>
                <tr>
                  <th width="45%">Description</th>
                  <th width="15%">Quantité</th>
                  <th width="20%">Prix unitaire</th>
                  <th width="20%">Total HT</th>
                </tr>
              </thead>
              <tbody>
                ${(order.items || order.order_items || []).map((item: any, index: number) => {
                  const itemTotal = item.total_price || (Number(item.unit_price || 0) * Number(item.quantity || 0));
                  const isService = !!item.service_id || !!item.service_name;
                  const description = isService
                    ? `${item.service_name || 'Service'}<br><small style="color: #6b7280; font-size: 12px;">Service ID: ${item.service_id || ''}</small>`
                    : `${item.product_name || 'Produit'} ${item.sku ? `<br><small style="color: #6b7280; font-size: 12px;">Réf: ${item.sku}</small>` : ''}`;

                  return `
                  <tr>
                    <td class="product-name">
                      ${description}
                    </td>
                    <td class="quantity-cell">${item.quantity || 0}</td>
                    <td class="price-cell">${formatCurrency(item.unit_price || 0)}</td>
                    <td class="total-cell">${formatCurrency(itemTotal)}</td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>
            
            <!-- Totaux -->
            <div class="totals-section">
              <div class="total-row">
                <span class="total-label">Sous-total HT</span>
                <span class="total-amount">${formatCurrency(subtotal)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Remise</span>
                <span class="total-amount">- ${formatCurrency(order.discount || 0)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Total TTC</span>
                <span class="total-amount grand-total">${formatCurrency(totalAmount - (order.discount || 0))}</span>
              </div>
            </div>
          </div>
          
          <!-- Pied de page -->
          <div class="invoice-footer">
            <div class="terms">
              <p>
                <strong>Conditions de paiement:</strong> Paiement à 30 jours fin de mois.<br>
                <strong>Pénalités de retard:</strong> Taux d'intérêt légal en vigueur majoré de 5 points.<br>
                <strong>Indemnité forfaitaire pour frais de recouvrement:</strong> 40F CFA.<br>
                Facture émise électroniquement, valeur probante équivalente à l'original.
              </p>
              <p style="margin-top: 20px; font-style: italic;">
                Merci pour votre confiance !<br>
                L'équipe RealTech Holding
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>`;

    // add A4 page size and optional stamp if order completed
    const showStamp = (order.status || '').toString().toLowerCase() === 'completed' || (order.status || '').toString().toLowerCase() === 'terminée' || (order.status || '').toString().toLowerCase() === 'terminée';
    const stampHtml = showStamp ? `<img src="/assets/cachet_realtech.png" class="invoice-stamp" alt="cachet" />` : '';

    // ensure A4 print size via @page and include stamp element
    const htmlWithPage = html.replace('</style>', `
          @page { size: A4; margin: 20mm; }
          .invoice-stamp { position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); width: 160px; opacity: 0.95; }
        </style>`).replace('</body>', `${stampHtml}</body>`);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // fallback: download HTML
      const blob = new Blob([htmlWithPage], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `Facture-${order.order_number || order.id}-${formatDate(order.placed_at || order.created_at).replace(/\//g, '-')}.html`;
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }

    printWindow.document.write(htmlWithPage);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        // keep window open so user can save; close after short delay
        setTimeout(() => { try { printWindow.close(); } catch (e) {} }, 1200);
      }, 500);
    };
    
  } catch (err) {
    console.error('Erreur lors de la génération de la facture:', err);
    // toast.error('❌ Impossible de générer la facture');
  }
};

const downloadInvoicePdf = async (order: any) => {
  try {
    // Fonctions utilitaires nécessaires
    const formatDate = (dateString: string | Date) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    };

    // Construire les données de la facture
    const companyInfo = {
      name: "Realtech Solutions",
      logo: '/assets/logo_realtech.png'
    };

    const invoiceDate = formatDate(order.placed_at || order.created_at || new Date());
    const subtotal = order.total_amount || (order.items || order.order_items || []).reduce((sum: number, item: any) =>
      sum + (item.total_price || (Number(item.unit_price || 0) * Number(item.quantity || 0))), 0);
    const taxRate = 0.20;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    // Générer le HTML de la facture
    const html = `<html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Facture ${order.order_number || order.id}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1f2937;
            background: white;
            min-height: 100vh;
            padding: 0;
            margin: 0;
            width: 210mm;
            height: 297mm;
          }
          
          .invoice-container {
            width: 210mm;
            min-height: 297mm;
            background: white;
            margin: 0;
            padding: 0;
            position: relative;
          }
          
          /* En-tête avec dégradé */
          .invoice-header {
            background: rgba(14, 214, 236, 0.43);
            color: white;
            padding: 40px;
            position: relative;
            overflow: hidden;
          }
          
          .invoice-header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
            background-size: 30px 30px;
            opacity: 0.1;
          }
          
          .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
            z-index: 1;
          }
          
          .company-logo {
            display: flex;
            align-items: center;
            gap: 20px;
          }
          
          .logo-img {
            width: 150px;
            height: auto;
            filter: brightness(0) invert(1);
          }
          
          .company-name {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          
          .invoice-title {
            text-align: right;
          }
          
          .invoice-title h1 {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 10px;
          }
          
          .invoice-title p {
            font-size: 16px;
            opacity: 0.9;
          }
          
          /* Corps de la facture */
          .invoice-body {
            padding: 40px;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .info-section h3 {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #6b7280;
            margin-bottom: 15px;
            font-weight: 600;
          }
          
          .info-content {
            background: #f9fafb;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
          }
          
          .info-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
          }
          
          .info-label {
            color: #6b7280;
            font-weight: 500;
          }
          
          .info-value {
            font-weight: 600;
            color: #1f2937;
            text-align: right;
            overflow-wrap: anywhere;
            word-break: break-all;
            display: inline-block;
            max-width: 220px;
          }
          
          /* Tableau des articles */
          .items-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin: 40px 0;
            overflow: hidden;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          
          .items-table thead {
            background: rgba(14, 214, 236, 0.43);
            color: white;
          }
          
          .items-table th {
            padding: 18px 20px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .items-table tbody tr {
            transition: background 0.2s;
          }
          
          .items-table tbody tr:nth-child(even) {
            background: #f9fafb;
          }
          
          .items-table tbody tr:hover {
            background: #f3f4f6;
          }
          
          .items-table td {
            padding: 16px 20px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
          }
          
          .product-name {
            font-weight: 500;
            color: #1f2937;
          }
          
          .quantity-cell {
            text-align: center;
          }
          
          .price-cell, .total-cell {
            text-align: right;
            font-family: 'Courier New', monospace;
            font-weight: 600;
          }
          
          /* Totaux */
          .totals-section {
            background: #f9fafb;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            margin-top: 40px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .total-row:last-child {
            border-bottom: none;
            font-size: 18px;
            font-weight: 700;
            color: #1f2937;
            padding-top: 20px;
          }
          
          .total-label {
            font-size: 14px;
            color: #6b7280;
          }
          
          .total-amount {
            font-family: 'Courier New', monospace;
            font-weight: 600;
            font-size: 16px;
          }
          
          .grand-total {
            font-size: 22px !important;
            color: #059669 !important;
          }
          
          /* Pied de page */
          .invoice-footer {
            padding: 40px;
            background: #f9fafb;
            border-top: 2px solid #e5e7eb;
          }
          
          .terms {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            line-height: 1.6;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          
          /* Éléments décoratifs */
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            font-weight: 900;
            color: rgba(59, 130, 246, 0.05);
            pointer-events: none;
            white-space: nowrap;
            z-index: 0;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
              margin: 0;
              width: 210mm;
              height: 297mm;
            }
            
            .invoice-container {
              box-shadow: none;
              border-radius: 0;
              width: 210mm;
              min-height: 297mm;
            }
            
            .invoice-header {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .items-table thead {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          
          @media screen and (max-width: 768px) {
            body {
              width: 100%;
              height: auto;
            }
            
            .invoice-container {
              width: 100%;
              min-height: auto;
            }
            
            .invoice-header {
              padding: 30px 20px;
            }
            
            .header-content {
              flex-direction: column;
              text-align: center;
              gap: 20px;
            }
            
            .company-logo {
              justify-content: center;
            }
            
            .invoice-title {
              text-align: center;
            }
            
            .invoice-body {
              padding: 30px 20px;
            }
            
            .info-grid {
              grid-template-columns: 1fr;
            }
            
            .items-table {
              font-size: 12px;
            }
            
            .items-table th,
            .items-table td {
              padding: 12px 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Filigrane -->
          <div class="watermark">FACTURE</div>
          
          <!-- En-tête -->
          <div class="invoice-header">
            <div class="header-content">
              <div class="company-logo">
                <div class="company-name"><img src="/assets/logo_realtech.png" alt="logo" style="height:72px;object-fit:contain;margin-bottom:6px" /></div>
              </div>
              <div class="invoice-title">
                <h1>FACTURE</h1>
                <p>${order.order_number || `INV-${order.id ? order.id.substring(0,8).toUpperCase() : '00000000'}`}</p>
                <p>Date: ${invoiceDate}</p>
              </div>
            </div>
          </div>
          
          <!-- Corps de la facture -->
          <div class="invoice-body">
            <!-- Informations -->
            <div class="info-grid">
              <!-- Entreprise -->
              <div class="info-section">
                <h3>Émetteur</h3>
                <div class="info-content">
                  <div class="info-item">
                    <span class="info-label">Société:</span>
                    <span class="info-value">RealTech Holding</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Adresse:</span>
                    <span class="info-value">Ouakam Cité Avion</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Téléphone:</span>
                    <span class="info-value">+221 77 422 03 20</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">sidydiop.boss@realtechprint.com</span>
                  </div>
                </div>
              </div>
              
              <!-- Client -->
              <div class="info-section">
                <h3>Client</h3>
                <div class="info-content">
                  <div class="info-item">
                    <span class="info-label">Nom:</span>
                    <span class="info-value">${order.client_record?.full_name || order.customer_name || 'Client'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${order.client_record?.email || order.customer_email || ''}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Téléphone:</span>
                    <span class="info-value">${order.client_record?.phone || order.customer_phone || ''}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">N° Commande:</span>
                    <span class="info-value">${order.order_number || order.id || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Tableau des articles -->
            <table class="items-table">
              <thead>
                <tr>
                  <th width="45%">Description</th>
                  <th width="15%">Quantité</th>
                  <th width="20%">Prix unitaire</th>
                  <th width="20%">Total HT</th>
                </tr>
              </thead>
              <tbody>
                ${(order.items || order.order_items || []).map((item: any, index: number) => {
                  const itemTotal = item.total_price || (Number(item.unit_price || 0) * Number(item.quantity || 0));
                  const isService = !!item.service_id || !!item.service_name;
                  const description = isService
                    ? `${item.service_name || 'Service'}<br><small style="color: #6b7280; font-size: 12px;">Service ID: ${item.service_id || ''}</small>`
                    : `${item.product_name || 'Produit'} ${item.sku ? `<br><small style="color: #6b7280; font-size: 12px;">Réf: ${item.sku}</small>` : ''}`;

                  return `
                  <tr>
                    <td class="product-name">
                      ${description}
                    </td>
                    <td class="quantity-cell">${item.quantity || 0}</td>
                    <td class="price-cell">${formatCurrency(item.unit_price || 0)}</td>
                    <td class="total-cell">${formatCurrency(itemTotal)}</td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>
            
            <!-- Totaux -->
            <div class="totals-section">
              <div class="total-row">
                <span class="total-label">Sous-total HT</span>
                <span class="total-amount">${formatCurrency(subtotal)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Remise</span>
                <span class="total-amount">- ${formatCurrency(order.discount || 0)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Total TTC</span>
                <span class="total-amount grand-total">${formatCurrency(totalAmount - (order.discount || 0))}</span>
              </div>
            </div>
          </div>
          
          <!-- Pied de page -->
          <div class="invoice-footer">
            <div class="terms">
              <p>
                <strong>Conditions de paiement:</strong> Paiement à 30 jours fin de mois.<br>
                <strong>Pénalités de retard:</strong> Taux d'intérêt légal en vigueur majoré de 5 points.<br>
                <strong>Indemnité forfaitaire pour frais de recouvrement:</strong> 40F CFA.<br>
                Facture émise électroniquement, valeur probante équivalente à l'original.
              </p>
              <p style="margin-top: 20px; font-style: italic;">
                Merci pour votre confiance !<br>
                L'équipe RealTech Holding
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>`;

    // Importer les bibliothèques
    const [jspdfMod, html2canvasMod] = await Promise.all([
      import('jspdf'),
      import('html2canvas')
    ]);
    
    const jsPDF = (jspdfMod && (jspdfMod.jsPDF || jspdfMod.default || jspdfMod));
    const html2canvas = (html2canvasMod && (html2canvasMod.default || html2canvasMod));
    
    // Ajouter un cachet si la commande est terminée
    const showStamp = (order.status || '').toString().toLowerCase() === 'completed' || (order.status || '').toString().toLowerCase() === 'terminée' || (order.status || '').toString().toLowerCase() === 'terminee';
    const stampHtml = showStamp ? `<div style="text-align:center;margin-top:12px"><img src="/assets/cachet_realtech.png" alt="cachet" style="width:160px;opacity:0.95"/></div>` : '';

    // Injecter le cachet juste avant le pied de page
    const htmlWithStamp = html.replace('<div class="invoice-footer">', `${stampHtml}<div class="invoice-footer">`);

    // Créer un iframe hors écran pour rendre le HTML
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    iframe.style.background = 'white';
    
    document.body.appendChild(iframe);
    
    const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
    if (!doc) {
      throw new Error('Impossible de créer le document iframe');
    }
    
    // Écrire le HTML (avec cachet éventuel) dans l'iframe
    doc.open();
    doc.write(htmlWithStamp);
    doc.close();
    
    // Attendre que l'iframe soit complètement chargé
    await new Promise<void>((resolve) => {
      if (doc.readyState === 'complete') {
        resolve();
      } else {
        iframe.onload = () => resolve();
        if (iframe.contentWindow) {
          iframe.contentWindow.addEventListener('load', () => resolve());
        }
      }
    });
    
    // Attendre un peu plus pour que tout soit rendu
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Sélectionner le conteneur principal
    const invoiceContainer = doc.querySelector('.invoice-container') as HTMLElement;
    if (!invoiceContainer) {
      document.body.removeChild(iframe);
      throw new Error('Conteneur de facture introuvable');
    }
    
    // Configurer html2canvas pour une capture optimisée
    const canvas = await html2canvas(invoiceContainer, {
      scale: 2, // Haute qualité
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: invoiceContainer.offsetWidth,
      height: invoiceContainer.offsetHeight,
      onclone: (clonedDoc) => {
        // Appliquer les styles d'impression sur le clone
        const clonedContainer = clonedDoc.querySelector('.invoice-container') as HTMLElement;
        if (clonedContainer) {
          clonedContainer.style.boxShadow = 'none';
          clonedContainer.style.borderRadius = '0';
          clonedContainer.style.maxWidth = '100%';
        }
      }
    });
    
    // Nettoyer l'iframe
    document.body.removeChild(iframe);
    
    // Créer le PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Calculer les dimensions pour s'adapter à la page A4
    const imgWidth = 210; // Largeur A4 en mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Ajouter l'image au PDF
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.95),
      'JPEG',
      0,
      0,
      imgWidth,
      imgHeight
    );
    
    // Télécharger le PDF
    pdf.save(`Facture-${order.order_number || order.id || 'N/A'}.pdf`);
    
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw error;
  }
};

// Fonctions utilitaires supplémentaires
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return new Date().toLocaleDateString('fr-FR');
  }
};


  const printOrder = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>Commande ${order.order_number || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111827 }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px }
            .company { text-align:left }
            .client { text-align:right }
            table { width:100%; border-collapse: collapse; margin-top:20px }
            th, td { border: 1px solid #ddd; padding: 8px; text-align:left }
            th { background:#f3f4f6 }
            .total { text-align:right; font-weight:700; margin-top:12px }
            img.logo { height:56px; object-fit:contain }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">
              <img class="logo" src="${logo_realtech}" />
              <div>Facture: ${order.order_number || (order.id || '').substring(0,8)}</div>
              <div>Date: ${formatDateTime(order.placed_at || order.created_at)}</div>
            </div>
            <div class="client">
              <div><strong>Client</strong></div>
              <div>${order.client_record?.full_name || order.customer_name || ''}</div>
              <div>${order.client_record?.email || order.customer_email || ''}</div>
              <div>${order.client_record?.phone || order.customer_phone || ''}</div>
              <div style="margin-top:8px"><strong>Vendeur</strong></div>
              <div>${currentUser?.last_name || currentUser?.name || ''} ${currentUser?.first_name || currentUser?.given_name || ''}</div>
              <div>${currentUser?.email || ''}</div>
            </div>
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
              ${(order.items || order.order_items || []).map((item: any) => {
                const isService = !!item.service_id || !!item.service_name;
                const name = isService ? (item.service_name || 'Service') : (item.product_name || 'Produit');
                const extra = isService ? `<div style="color:#6b7280;font-size:12px">Service ID: ${item.service_id || ''}</div>` : (item.sku ? `<div style="color:#6b7280;font-size:12px">Réf: ${item.sku}</div>` : '');
                return `
                <tr>
                  <td>${name}${extra}</td>
                  <td>${item.quantity || 0}</td>
                  <td>${formatCurrency(item.unit_price || 0)}</td>
                  <td>${formatCurrency(item.total_price || (Number(item.unit_price || 0) * Number(item.quantity || 0)))}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
          <div class="total">Total: ${formatCurrency(order.total_amount || 0)}</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 1000);
            }
          </script>
        </body>
      </html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Cancel Order Modal */}
      {/* ── Complete Order Dialog ── */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Finaliser la commande
            </DialogTitle>
            <DialogDescription>
              {selectedOrder?.order_number && `#${selectedOrder.order_number} — `}
              Précisez le paiement et l'état de livraison avant de valider.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Payment */}
            <div>
              <Label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-600" /> Paiement
              </Label>
              <div className="flex rounded-lg border overflow-hidden">
                {([['paid','Payée'],['unpaid','Non payée']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setCompletePayment(val)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      completePayment === val
                        ? val === 'paid' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery */}
            <div>
              <Label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-600" /> Livraison
              </Label>
              <div className="space-y-2">
                {([
                  ['full',    'Totalement livrée',     'Tout le stock commandé est sorti.'],
                  ['partial', 'Partiellement livrée',  'Précisez les quantités livrées.'],
                  ['none',    'Non livrée',             'Aucune sortie de stock maintenant.'],
                ] as const).map(([val, label, desc]) => (
                  <button key={val} onClick={() => setCompleteDelivery(val)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      completeDelivery === val
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}>
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                      completeDelivery === val ? 'border-primary' : 'border-muted-foreground'
                    }`}>
                      {completeDelivery === val && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Partial quantities */}
            {completeDelivery === 'partial' && (
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantités livrées</p>
                {(selectedOrder?.items || []).filter((it: any) => it.product_id).map((it: any) => (
                  <div key={it.product_id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{it.product_name}</div>
                      <div className="text-xs text-muted-foreground">Commandé : {it.quantity}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                        disabled={(completeDeliveredQtys[it.product_id] || 0) <= 0}
                        onClick={() => setCompleteDeliveredQtys(p => ({ ...p, [it.product_id]: Math.max(0, (p[it.product_id] || 0) - 1) }))}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Input type="number" min={0} max={it.quantity}
                        value={completeDeliveredQtys[it.product_id] ?? it.quantity}
                        onChange={e => setCompleteDeliveredQtys(p => ({ ...p, [it.product_id]: Math.min(Number(it.quantity), Math.max(0, Number(e.target.value))) }))}
                        className="w-14 h-7 text-center text-sm p-1" />
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                        disabled={(completeDeliveredQtys[it.product_id] ?? it.quantity) >= Number(it.quantity)}
                        onClick={() => setCompleteDeliveredQtys(p => ({ ...p, [it.product_id]: Math.min(Number(it.quantity), (p[it.product_id] ?? Number(it.quantity)) + 1) }))}>
                        <Plus className="w-3 h-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground w-8">/ {it.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Result indicator */}
          {(() => {
            const willComplete = completeDelivery === 'full' && completePayment === 'paid';
            return (
              <div className={`rounded-lg px-4 py-3 flex items-center gap-3 text-sm font-medium ${
                willComplete
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-blue-50 border border-blue-200 text-blue-800'
              }`}>
                {willComplete
                  ? <><CheckCircle className="w-4 h-4 shrink-0" /> La commande sera marquée <strong>Terminée</strong></>
                  : <><Loader2 className="w-4 h-4 shrink-0" /> La commande sera marquée <strong>En cours</strong> — livraison ou paiement incomplet</>
                }
              </div>
            );
          })()}

          <DialogFooter>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setCompleteOpen(false)}>Annuler</Button>
              <Button
                className={`flex-1 ${completeDelivery === 'full' && completePayment === 'paid' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                onClick={handleCompleteOrder} disabled={completing}>
                {completing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />En cours…</> : <><CheckCircle className="w-4 h-4 mr-2" />Confirmer</>}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Order Dialog ── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Annuler la commande
            </DialogTitle>
            <DialogDescription>
              {selectedOrder?.order_number && `#${selectedOrder.order_number} — `}
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <Label className="text-sm font-medium mb-2 block">Motif d'annulation (facultatif)</Label>
              <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder="Ex : client a changé d'avis…" />
            </div>

            {/* Return section — only if order was completed/in_progress with deliveries */}
            {(selectedOrder?.status === 'completed' || selectedOrder?.status === 'in_progress') && selectedOrder?.metadata?.delivery?.delivery_status !== 'none' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  Des produits avaient été livrés — retour en stock ?
                </p>
                <div className="space-y-2">
                  {([
                    ['none',    'Aucun retour',         'Le stock n\'est pas modifié.'],
                    ['full',    'Retour total',          'Tout ce qui a été livré revient en stock.'],
                    ['partial', 'Retour partiel',        'Précisez les quantités retournées.'],
                  ] as const).map(([val, label, desc]) => (
                    <button key={val} onClick={() => setCancelReturnMode(val)}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                        cancelReturnMode === val
                          ? 'border-amber-500 bg-white'
                          : 'border-transparent bg-white/60 hover:bg-white'
                      }`}>
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                        cancelReturnMode === val ? 'border-amber-500' : 'border-muted-foreground'
                      }`}>
                        {cancelReturnMode === val && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {cancelReturnMode === 'partial' && (
                  <div className="rounded-lg border bg-white p-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantités retournées</p>
                    {(selectedOrder?.metadata?.delivery?.delivered_items || selectedOrder?.items || [])
                      .filter((it: any) => it.product_id)
                      .map((it: any) => {
                        const maxQty = it.delivered_qty ?? Number(it.quantity || 0);
                        const pid = it.product_id;
                        return (
                          <div key={pid} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{it.product_name}</div>
                              <div className="text-xs text-muted-foreground">Livré : {maxQty}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                                disabled={(cancelReturnedQtys[pid] || 0) <= 0}
                                onClick={() => setCancelReturnedQtys(p => ({ ...p, [pid]: Math.max(0, (p[pid] || 0) - 1) }))}>
                                <Minus className="w-3 h-3" />
                              </Button>
                              <Input type="number" min={0} max={maxQty}
                                value={cancelReturnedQtys[pid] ?? maxQty}
                                onChange={e => setCancelReturnedQtys(p => ({ ...p, [pid]: Math.min(maxQty, Math.max(0, Number(e.target.value))) }))}
                                className="w-14 h-7 text-center text-sm p-1" />
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                                disabled={(cancelReturnedQtys[pid] ?? maxQty) >= maxQty}
                                onClick={() => setCancelReturnedQtys(p => ({ ...p, [pid]: Math.min(maxQty, (p[pid] ?? maxQty) + 1) }))}>
                                <Plus className="w-3 h-3" />
                              </Button>
                              <span className="text-xs text-muted-foreground w-8">/ {maxQty}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setCancelOpen(false)}>Fermer</Button>
              <Button variant="destructive" className="flex-1" onClick={handleCancelWithReturn} disabled={cancelling}>
                {cancelling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Annulation…</> : <>Confirmer l'annulation</>}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptNiA2djZoNnYtNmgtNnptLTEyIDBoNnY2aC02di02em0tNiAwaDZ2Nmgtdnptlti2LTZoNnY2aC02di02em02LTZoNnY2aC02di02em0tNiAxMmg2djZoLTZ2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 shadow-inner">
              <ShoppingCart className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Commandes & Ventes</h1>
              <p className="text-blue-200 text-sm mt-0.5">{orders.length} transaction{orders.length !== 1 ? 's' : ''} au total</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => openCreateModal('direct_sale')} className="bg-emerald-500 hover:bg-emerald-400 text-white shadow font-semibold">
              <CreditCard className="mr-2 h-4 w-4" />
              Vente directe
            </Button>
            <Button onClick={() => openCreateModal('order')} className="bg-white/15 hover:bg-white/25 text-white border-white/20 border backdrop-blur">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Nouvelle commande
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600/80 uppercase tracking-wide">Total</p>
                <p className="text-3xl font-bold text-blue-900 mt-0.5">{calculateTotals.total}</p>
                <p className="text-xs text-blue-600/60 mt-0.5">transactions</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        {!isEmployee && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-600/80 uppercase tracking-wide">CA réel</p>
                <p className="text-2xl font-bold text-emerald-900 mt-0.5">{formatCurrency(calculateTotals.revenue)}</p>
                <p className="text-xs text-emerald-600/60 mt-0.5">ventes complétées</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        )}
        {!isEmployee && calculateTotals.gainReel !== 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-teal-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-teal-600/80 uppercase tracking-wide">Gain réel</p>
                <p className="text-2xl font-bold text-teal-900 mt-0.5">{formatCurrency(calculateTotals.gainReel)}</p>
                <p className="text-xs text-teal-600/60 mt-0.5">bénéfice net</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        )}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600/80 uppercase tracking-wide">En attente</p>
                <p className="text-3xl font-bold text-amber-900 mt-0.5">{calculateTotals.pending}</p>
                <p className="text-xs text-amber-600/60 mt-0.5">à traiter</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600/80 uppercase tracking-wide">En cours</p>
                <p className="text-3xl font-bold text-blue-900 mt-0.5">{calculateTotals.in_progress}</p>
                <p className="text-xs text-blue-600/60 mt-0.5">partiel</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-violet-600/80 uppercase tracking-wide">Terminées</p>
                <p className="text-3xl font-bold text-violet-900 mt-0.5">{calculateTotals.completed}</p>
                <p className="text-xs text-violet-600/60 mt-0.5">finalisées</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <Check className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Numéro, client, téléphone…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchOrders}
                className="h-10 w-10 shrink-0"
                disabled={loading}
                title="Rafraîchir"
              >
                <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Sale type quick filter */}
              <div className="flex rounded-lg border overflow-hidden text-sm">
                {[
                  { val: 'all',         label: 'Tous' },
                  { val: 'direct_sale', label: 'Ventes' },
                  { val: 'order',       label: 'Commandes' },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => setSaleTypeFilter(val)}
                    className={`px-3 py-1.5 font-medium transition-colors ${
                      saleTypeFilter === val
                        ? val === 'direct_sale'
                          ? 'bg-emerald-600 text-white'
                          : val === 'order'
                          ? 'bg-blue-600 text-white'
                          : 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-auto min-w-[140px] text-sm">
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Terminée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-9 w-auto min-w-[130px] text-sm">
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toute période</SelectItem>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="week">7 derniers jours</SelectItem>
                  <SelectItem value="month">30 derniers jours</SelectItem>
                </SelectContent>
              </Select>
              {(saleTypeFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all' || searchQuery) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setSaleTypeFilter('all'); setStatusFilter('all'); setDateFilter('all'); setSearchQuery(''); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Réinitialiser
                </Button>
              )}
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
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold">Référence</TableHead>
                      <TableHead className="font-semibold">Client</TableHead>
                      <TableHead className="font-semibold hidden md:table-cell">Articles</TableHead>
                      <TableHead className="font-semibold">Montant</TableHead>
                      <TableHead className="font-semibold">Statut</TableHead>
                      <TableHead className="font-semibold hidden sm:table-cell">Date</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOrders.map((order) => {
                      const isSale = order.metadata?.sale_context?.sale_type === 'direct_sale';
                      const clientName = order.metadata?.customer?.name || order.client_record?.full_name || order.customer_name || '—';
                      const clientContact = order.metadata?.customer?.phone || order.client_record?.phone || order.customer_phone || order.metadata?.customer?.email || '';
                      return (
                      <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSale ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                              {isSale
                                ? <CreditCard className="h-4 w-4 text-emerald-600" />
                                : <ShoppingCart className="h-4 w-4 text-blue-600" />
                              }
                            </div>
                            <div>
                              <div className="font-semibold text-sm">#{order.order_number || order.id.substring(0, 8)}</div>
                              <div className={`text-xs font-medium ${isSale ? 'text-emerald-600' : 'text-blue-600'}`}>
                                {isSale ? 'Vente directe' : 'Commande'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[160px]">
                            <div className="font-medium text-sm truncate">{clientName}</div>
                            {clientContact && <div className="text-xs text-muted-foreground truncate">{clientContact}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {Array.isArray(order.items) ? order.items.length : 0} article{(Array.isArray(order.items) ? order.items.length : 0) !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-sm">{formatCurrency(order.total_amount)}</div>
                          {order.catalog_amount > 0 && order.catalog_amount !== order.total_amount && (
                            <div className="text-xs text-muted-foreground line-through">{formatCurrency(order.catalog_amount)}</div>
                          )}
                          {!isEmployee && order.cost_amount > 0 && (
                            <div className="text-xs text-teal-600 font-medium">
                              +{formatCurrency(order.total_amount - order.cost_amount)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.status === 'completed' || order.status === 'cancelled' ? (
                            <StatusBadge status={order.status} />
                          ) : (
                            <Select
                              value={order.status}
                              onValueChange={(value) => {
                                if (value === 'cancelled') {
                                  openCancelDialog(order);
                                } else if (value === 'completed') {
                                  openCompleteDialog(order);
                                } else {
                                  handleStatusChange(order.id, value);
                                }
                              }}
                            >
                              <SelectTrigger className="w-36 h-8">
                                <StatusBadge status={order.status} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">
                                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" />En attente</div>
                                </SelectItem>
                                <SelectItem value="completed">
                                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Finaliser…</div>
                                </SelectItem>
                                <SelectItem value="cancelled">
                                  <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500" />Annuler…</div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="text-sm text-muted-foreground">
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
                                  {/* If order is completed, only allow cancellation (and viewing). */}
                                  {order.status !== 'cancelled' && (
                                    <DropdownMenuItem onClick={() => downloadInvoicePdf(order)}>
                                      <Download className="mr-2 h-4 w-4" />
                                      Télécharger le PDF
                                    </DropdownMenuItem>
                                  )}
                                  {(order.status === 'pending' || order.status === 'in_progress') && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => openCompleteDialog(order)}>
                                        <Check className="mr-2 h-4 w-4 text-emerald-600" />
                                        {order.status === 'in_progress' ? 'Continuer la finalisation' : 'Finaliser la commande'}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {order.status !== 'cancelled' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => openCancelDialog(order)} className="text-destructive">
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Annuler la commande
                                      </DropdownMenuItem>
                                    </>
                                  )}
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
                <div className="flex justify-end gap-2 mt-2">
                  {((selectedOrder.status || '').toString().toLowerCase() !== 'cancelled' && (selectedOrder.status || '').toString().toLowerCase() !== 'annulée') && (
                    <Button variant="outline" onClick={() => downloadInvoicePdf(selectedOrder)}>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger PDF
                    </Button>
                  )}
                </div>
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
                            <p className="font-medium">{orderClientRecord?.full_name || selectedOrder.customer_name || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{orderClientRecord?.phone || selectedOrder.customer_phone || 'N/A'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{orderClientRecord?.email || selectedOrder.customer_email || 'N/A'}</p>
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

                  {/* Treatment history (traiter_par) */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Historique traitement</CardTitle>
                      <CardDescription>
                        Utilisateurs ayant traité la commande et actions effectuées
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {Array.isArray(selectedOrder?.metadata?.traiter_par) && selectedOrder.metadata.traiter_par.length > 0 ? (
                        <div className="space-y-2">
                          {selectedOrder.metadata.traiter_par.map((entry: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{entry.name || entry.user_id || 'Utilisateur'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {Array.isArray(entry.roles) ? entry.roles.join(', ') : entry.roles}
                                </div>
                                <div className="text-xs text-muted-foreground">Action: {entry.action}</div>
                              </div>
                              <div className="text-right text-sm">
                                <div>Count: {entry.count || 1}</div>
                                <div className="text-xs text-muted-foreground">Dernier: {entry.last_at ? formatDateTime(entry.last_at) : ''}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Aucun historique de traitement disponible</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="products">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Produits commandés</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                          <img src={logo_realtech} alt="Realtech" className="w-28 h-14 object-contain" />
                          <div className="text-sm text-muted-foreground">
                            <div className="font-medium">Facture: {selectedOrder.order_number || (selectedOrder.id || '').substring(0,8)}</div>
                            <div>Établie par:</div>
                            <div className="text-xs">{currentUser?.last_name || currentUser?.name || ''} {currentUser?.first_name || currentUser?.given_name || ''}</div>
                            <div className="text-xs">{currentUser?.email || ''}</div>
                            <div className="text-xs">{currentUser?.phone || ''}</div>
                          </div>
                        </div>

                        <div className="text-right text-sm">
                          <div className="font-medium">Client</div>
                          <div>{orderClientRecord?.full_name || selectedOrder.customer_name || selectedOrder.customer_full_name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">{orderClientRecord?.email || selectedOrder.customer_email || ''}</div>
                          <div className="text-xs text-muted-foreground">{orderClientRecord?.phone || selectedOrder.customer_phone || ''}</div>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Article</TableHead>
                            <TableHead className="text-right">Qté</TableHead>
                            <TableHead className="text-right">Prix catalogue</TableHead>
                            <TableHead className="text-right">Prix réel</TableHead>
                            {!isEmployee && <TableHead className="text-right">Prix achat</TableHead>}
                            <TableHead className="text-right">Total réel</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems.map((item, index) => {
                            const catalogP  = Number(item.catalog_price  || item.unit_price || 0);
                            const realP     = Number(item.unit_price || 0);
                            const purchaseP = Number(item.purchase_price || 0);
                            const qty       = Number(item.quantity || 0);
                            const hasDiscount = catalogP > 0 && realP < catalogP;
                            return (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="font-medium">{item.product_name || item.service_name || 'Article'}</div>
                                  {item.service_id ? (
                                    <Badge variant="outline" className="text-xs">Service</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">Produit</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{qty}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(catalogP)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={hasDiscount ? 'text-amber-600 font-semibold' : ''}>
                                  {formatCurrency(realP)}
                                </span>
                                {hasDiscount && (
                                  <div className="text-xs text-amber-500">−{formatCurrency(catalogP - realP)}</div>
                                )}
                              </TableCell>
                              {!isEmployee && (
                                <TableCell className="text-right text-muted-foreground text-sm">
                                  {purchaseP > 0 ? formatCurrency(purchaseP) : '—'}
                                </TableCell>
                              )}
                              <TableCell className="text-right font-medium">
                                {formatCurrency(realP * qty)}
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </Table>

                      <div className="flex justify-end border-t pt-4 mt-4">
                        <div className="text-right space-y-2 min-w-[280px]">
                          {selectedOrder.catalog_amount > 0 && selectedOrder.catalog_amount !== selectedOrder.total_amount && (
                            <div className="flex items-center justify-between gap-8">
                              <span className="text-sm text-muted-foreground">Total catalogue</span>
                              <span className="font-medium line-through text-muted-foreground">
                                {formatCurrency(selectedOrder.catalog_amount)}
                              </span>
                            </div>
                          )}
                          {selectedOrder.catalog_amount > 0 && selectedOrder.catalog_amount !== selectedOrder.total_amount && (
                            <div className="flex items-center justify-between gap-8">
                              <span className="text-sm text-amber-600">Remise accordée</span>
                              <span className="font-medium text-amber-600">
                                −{formatCurrency(selectedOrder.catalog_amount - selectedOrder.total_amount)}
                              </span>
                            </div>
                          )}
                          {selectedOrder.shipping_fee && (
                            <div className="flex items-center justify-between gap-8">
                              <span className="text-sm text-muted-foreground">Livraison</span>
                              <span className="font-medium">{formatCurrency(selectedOrder.shipping_fee)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-8 border-t pt-2">
                            <span className="text-lg font-bold">Total réel</span>
                            <span className="text-2xl font-bold text-primary">
                              {formatCurrency(selectedOrder.total_amount)}
                            </span>
                          </div>
                          {!isEmployee && selectedOrder.cost_amount > 0 && (
                            <>
                              <div className="flex items-center justify-between gap-8 pt-2 border-t">
                                <span className="text-sm text-muted-foreground">Coût d'achat</span>
                                <span className="text-sm font-medium text-muted-foreground">
                                  {formatCurrency(selectedOrder.cost_amount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-8">
                                <span className="text-sm font-semibold text-teal-700">Gain réel</span>
                                <span className="text-base font-bold text-teal-700">
                                  +{formatCurrency(selectedOrder.total_amount - selectedOrder.cost_amount)}
                                </span>
                              </div>
                              {selectedOrder.catalog_amount > 0 && (
                                <div className="flex items-center justify-between gap-8">
                                  <span className="text-xs text-muted-foreground">Gain estimé (catalogue)</span>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    +{formatCurrency(selectedOrder.catalog_amount - selectedOrder.cost_amount)}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
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
                          disabled={selectedOrder?.status === 'completed' || selectedOrder?.status === 'cancelled'}
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
                            disabled={savingNotes || selectedOrder?.status === 'completed' || selectedOrder?.status === 'cancelled'}
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
                  {(selectedOrder?.status === 'pending' || selectedOrder?.status === 'in_progress') && (
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => openCompleteDialog(selectedOrder)}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {selectedOrder?.status === 'in_progress' ? 'Continuer' : 'Finaliser'}
                    </Button>
                  )}
                  {selectedOrder?.status !== 'cancelled' && (
                    <Button variant="destructive" className="flex-1" onClick={() => openCancelDialog(selectedOrder)}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Annuler
                    </Button>
                  )}

                  {selectedOrder?.status !== 'cancelled' && (
                    <Button onClick={() => downloadInvoicePdf(selectedOrder)}>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger le PDF
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Order Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-full max-w-5xl p-0 gap-0 flex flex-col" style={{ height: '88vh', maxHeight: '88vh', overflow: 'hidden' }}>

          {/* ── Header ── */}
          <div className={`px-5 pt-4 pb-3 border-b shrink-0 ${saleType === 'direct_sale' ? 'bg-emerald-50' : 'bg-blue-50/50'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {saleType === 'direct_sale'
                    ? <><CreditCard className="w-5 h-5 text-emerald-600" /> Vente directe / Encaissement</>
                    : <><ShoppingCart className="w-5 h-5 text-blue-600" /> Nouvelle commande</>}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {saleType === 'direct_sale'
                    ? 'Client présent — stock décrémenté immédiatement, paiement encaissé.'
                    : 'Commande à préparer — statut "en attente", livraison possible.'}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Type toggle */}
                <div className="flex rounded-lg border overflow-hidden">
                  <button onClick={() => setSaleType('direct_sale')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${saleType === 'direct_sale' ? 'bg-emerald-600 text-white' : 'bg-white text-muted-foreground hover:bg-muted'}`}>
                    <CreditCard className="w-3.5 h-3.5" /> Vente directe
                  </button>
                  <button onClick={() => setSaleType('order')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${saleType === 'order' ? 'bg-blue-600 text-white' : 'bg-white text-muted-foreground hover:bg-muted'}`}>
                    <ShoppingCart className="w-3.5 h-3.5" /> Commande
                  </button>
                </div>
                {/* Mobile tabs */}
                <div className="flex lg:hidden rounded-lg border overflow-hidden">
                  <button onClick={() => setCreateTab('catalogue')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${createTab === 'catalogue' ? 'bg-primary text-primary-foreground' : 'bg-white text-muted-foreground'}`}>
                    <Package className="w-3.5 h-3.5" /> Catalogue
                    {newOrderItemsLocal.length > 0 && <span className="bg-primary-foreground text-primary text-xs rounded-full px-1 font-bold">{newOrderItemsLocal.length}</span>}
                  </button>
                  <button onClick={() => setCreateTab('panier')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${createTab === 'panier' ? 'bg-primary text-primary-foreground' : 'bg-white text-muted-foreground'}`}>
                    <ShoppingCart className="w-3.5 h-3.5" /> Panier
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Body : flex-row, chaque colonne gère son propre scroll ── */}
          <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

            {/* ── Gauche : Catalogue ── */}
            <div className={`flex flex-col border-r overflow-hidden ${createTab === 'panier' ? 'hidden lg:flex' : 'flex'}`}
              style={{ width: '58%', minWidth: 0 }}>

              {/* Barre de recherche + filtres */}
              <div className="p-3 border-b shrink-0 space-y-2 bg-background">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex rounded-lg border overflow-hidden shrink-0">
                    <button onClick={() => setShowServices(false)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${!showServices ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      Produits
                    </button>
                    <button onClick={() => setShowServices(true)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${showServices ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      Services
                    </button>
                  </div>
                  <div className="relative flex-1 min-w-[140px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                    <Input
                      placeholder={showServices ? 'Rechercher service…' : 'Rechercher produit…'}
                      value={showServices ? serviceSearch : productSearch}
                      onChange={e => showServices ? setServiceSearch(e.target.value) : setProductSearch(e.target.value)}
                      className="pl-8 h-8 text-sm" />
                  </div>
                </div>
                {!showServices && (
                  <Select value={productCategoryFilter} onValueChange={setProductCategoryFilter}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue placeholder="Toutes catégories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes catégories</SelectItem>
                      {categories?.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  {showServices ? filteredServices.length : filteredProducts.length} résultat(s)
                </p>
              </div>

              {/* Liste scrollable */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {showServices ? (
                  filteredServices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Aucun service trouvé</p>
                    </div>
                  ) : filteredServices.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-all">
                      <div className="w-9 h-9 rounded-md bg-purple-100 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{s.name}</div>
                        {s.description && <div className="text-xs text-muted-foreground truncate">{s.description}</div>}
                      </div>
                      <div className="text-sm font-semibold shrink-0">{formatCurrency(Number(s.price || 0))}</div>
                      <Button size="sm" className="h-8 shrink-0" onClick={() => { addServiceToOrder(s); setCreateTab('panier'); }}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                ) : (
                  filteredProducts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Aucun produit trouvé</p>
                    </div>
                  ) : filteredProducts.map(p => (
                    <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${p.stock <= 0 ? 'opacity-50' : 'hover:border-primary/50 hover:bg-muted/30'}`}>
                      <div className="w-9 h-9 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm truncate">{p.name}</span>
                          {p.stock <= 0 && <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5">Rupture</span>}
                          {p.stock > 0 && p.stock <= 10 && <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5">Stock faible</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{p.category?.name || 'Non catégorisé'}</span>
                          <span>·</span>
                          <span className={`font-medium ${p.stock > 10 ? 'text-emerald-600' : 'text-amber-600'}`}>{p.stock || 0} en stock</span>
                        </div>
                      </div>
                      <div className="text-sm font-semibold shrink-0">{formatCurrency(Number(p.price || 0))}</div>
                      <Button size="sm" className="h-8 shrink-0" disabled={p.stock <= 0}
                        onClick={() => { addProductToOrder(p); setCreateTab('panier'); }}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── Droite : Panier + Client + Résumé ── */}
            <div className={`flex flex-col overflow-hidden bg-background ${createTab === 'catalogue' ? 'hidden lg:flex' : 'flex'}`}
              style={{ width: '42%', minWidth: 0 }}>

              {/* Client */}
              <div className="px-4 pt-3 pb-3 border-b shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    Client
                    {saleType === 'order' && !onlyServices && <span className="text-red-500 text-xs ml-1">*requis</span>}
                    {saleType === 'direct_sale' && <span className="text-xs text-muted-foreground ml-1">(optionnel)</span>}
                  </p>
                  {orderClient && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setOrderClient(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {orderClient ? (
                  <div className={`flex items-center gap-2.5 p-2.5 rounded-lg border-2 ${saleType === 'direct_sale' ? 'border-emerald-300 bg-emerald-50' : 'border-blue-300 bg-blue-50'}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {(orderClient.full_name || orderClient.name || 'C')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{orderClient.full_name || orderClient.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{orderClient.email || orderClient.phone}</div>
                    </div>
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                      <Input placeholder="Rechercher client…" value={clientSearch}
                        onChange={e => setClientSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1">
                      {filteredClients.length === 0
                        ? <p className="text-xs text-muted-foreground text-center py-2">Aucun client trouvé</p>
                        : filteredClients.slice(0, 10).map(c => (
                          <div key={c.id} onClick={() => setOrderClient(c)}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                              {(c.full_name || c.name || 'C')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{c.full_name || c.name || 'Sans nom'}</div>
                              <div className="text-xs text-muted-foreground truncate">{c.email || c.phone}</div>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>

              {/* Panier — scrollable, prend tout l'espace restant */}
              <div className="flex flex-col flex-1 overflow-hidden border-b">
                <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" />
                    Panier
                    {newOrderItemsLocal.length > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 font-bold">
                        {newOrderItemsLocal.length}
                      </span>
                    )}
                  </p>
                  {newOrderItemsLocal.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setNewOrderItemsLocal([])}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Vider
                    </Button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
                  {newOrderItemsLocal.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Panier vide</p>
                      <p className="text-xs mt-1 opacity-70">Ajoutez des articles depuis le catalogue</p>
                    </div>
                  ) : newOrderItemsLocal.map(it => {
                    const itemId = it.product_id || it.service_id;
                    const catalogP = Number(it.catalog_price || it.unit_price || 0);
                    const realP = Number(it.unit_price || 0);
                    const hasRemise = realP < catalogP;
                    return (
                      <div key={itemId} className="p-2.5 rounded-lg border group hover:border-primary/40 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{it.product_name || it.service_name}</div>
                            <div className="text-xs text-muted-foreground">
                              Prix : <span className={hasRemise ? 'line-through' : ''}>{formatCurrency(catalogP)}</span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={() => removeItem(itemId)}>
                            <X className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Prix réel :</Label>
                          <Input type="number" min="0" value={realP}
                            onChange={e => updateItemRealPrice(itemId, Number(e.target.value) || 0)}
                            className={`h-7 text-right text-sm flex-1 ${hasRemise ? 'border-amber-400 text-amber-700 font-semibold' : ''}`} />
                          <span className="text-xs text-muted-foreground">F</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={it.quantity <= 1}
                              onClick={() => updateItemQuantity(itemId, Number(it.quantity) - 1)}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input type="number" min="1"
                              max={it.product_id ? getProductStock(it.product_id) : undefined}
                              value={it.quantity} className="w-12 h-7 text-center text-sm p-1"
                              onChange={e => {
                                const v = Number(e.target.value) || 1;
                                updateItemQuantity(itemId, it.product_id
                                  ? Math.max(1, Math.min(getProductStock(it.product_id), v))
                                  : Math.max(1, v));
                              }} />
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                              disabled={it.product_id ? Number(it.quantity) >= getProductStock(it.product_id) : false}
                              onClick={() => updateItemQuantity(itemId, Number(it.quantity) + 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{formatCurrency(realP * Number(it.quantity || 0))}</div>
                            {hasRemise && <div className="text-xs text-amber-500">−{formatCurrency((catalogP - realP) * Number(it.quantity || 0))}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Résumé + bouton — toujours visible en bas */}
              <div className="px-4 py-3 shrink-0 bg-background border-t shadow-[0_-2px_8px_rgba(0,0,0,0.06)] space-y-3">
                {/* Totaux */}
                <div className="space-y-1 text-sm">
                  {catalogTotal > 0 && catalogTotal !== totalAmount && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total catalogue</span>
                      <span className="line-through">{formatCurrency(catalogTotal)}</span>
                    </div>
                  )}
                  {catalogTotal > totalAmount && (
                    <div className="flex justify-between text-amber-600 text-xs">
                      <span>Remise articles</span>
                      <span>−{formatCurrency(catalogTotal - totalAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Remise globale</span>
                    <div className="flex items-center gap-1">
                      <Input type="number" placeholder="0" value={discount} min="0" max={totalAmount}
                        onChange={e => setDiscount(Number(e.target.value) || 0)}
                        className="w-18 h-7 text-right text-sm" />
                      <span className="text-xs">F</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t">
                    <span>Total à régler</span>
                    <span className={saleType === 'direct_sale' ? 'text-emerald-700' : 'text-blue-700'}>
                      {formatCurrency(Math.max(0, totalAmount - (discount || 0)))}
                    </span>
                  </div>
                </div>

                {/* Mode de paiement */}
                <div>
                  <Label className={`text-xs font-semibold mb-1 block ${saleType === 'direct_sale' ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                    Paiement {saleType === 'direct_sale' && <span className="text-red-500">*</span>}
                  </Label>
                  <div className="grid grid-cols-4 gap-1">
                    {[{ val: 'cash', label: 'Espèces' }, { val: 'card', label: 'Carte' }, { val: 'transfer', label: 'Virement' }, { val: 'wave', label: 'Wave/OM' }].map(({ val, label }) => (
                      <button key={val} onClick={() => setPaymentMethod(val)}
                        className={`py-1.5 rounded-md border text-xs font-medium transition-all ${
                          paymentMethod === val
                            ? saleType === 'direct_sale' ? 'border-emerald-500 bg-emerald-100 text-emerald-800' : 'border-primary bg-primary/10 text-primary'
                            : 'border-muted text-muted-foreground hover:border-gray-300'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Livraison (commande seulement) */}
                {saleType === 'order' && (
                  <Select value={shippingMethod} onValueChange={setShippingMethod}>
                    <SelectTrigger className="h-8 text-sm">
                      <Truck className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Livraison" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">Retrait en boutique</SelectItem>
                      <SelectItem value="standard">Livraison standard</SelectItem>
                      <SelectItem value="express">Livraison express</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Notes */}
                <Textarea placeholder="Notes…" value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                  rows={2} className="text-sm resize-none" />

                {/* Messages d'erreur */}
                {newOrderItemsLocal.length === 0 && (
                  <p className="text-xs text-destructive text-center">⚠ Ajoutez au moins un article</p>
                )}
                {saleType === 'order' && !onlyServices && !orderClient && newOrderItemsLocal.length > 0 && (
                  <p className="text-xs text-destructive text-center">⚠ Un client est requis pour cette commande</p>
                )}

                {/* Boutons d'action */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setCreateOpen(false)} className="h-10">
                    Annuler
                  </Button>
                  <Button
                    onClick={createOrderFromModal}
                    disabled={savingOrder || newOrderItemsLocal.length === 0 || (saleType === 'order' && !onlyServices && !orderClient)}
                    className={`h-10 font-semibold ${saleType === 'direct_sale' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
                    {savingOrder
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />En cours…</>
                      : saleType === 'direct_sale'
                        ? <><CreditCard className="w-4 h-4 mr-2" />Encaisser</>
                        : <><CheckCircle className="w-4 h-4 mr-2" />Créer la commande</>}
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;