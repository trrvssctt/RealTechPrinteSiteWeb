import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiFetch } from '@/lib/api';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Copy, 
  ExternalLink, 
  Upload, 
  Download, 
  Search, 
  AlertTriangle,
  Eye,
  Package,
  TrendingUp,
  DollarSign,
  BarChart3,
  Filter,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Grid,
  List,
  Star,
  RefreshCw,
  Layers,
  CheckCircle,
  XCircle,
  PackageOpen,
  ShoppingBag,
  Tag,
  Image as ImageIcon,
  Settings
} from "lucide-react";
import { ProductModal } from "@/components/admin/ProductModal";
import { exportProductsToCSV, parseCSVFile } from "@/utils/csvUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

const Products = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [loading, setLoading] = useState(true);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [visibleColumns, setVisibleColumns] = useState({
    image: true,
    sku: true,
    name: true,
    category: true,
    price: true,
    stock: true,
    status: true,
    featured: true,
    sales: false,
    updated: false,
  });

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterAndSortProducts();
  }, [products, searchTerm, filterCategory, filterStock, filterStatus, sortBy, sortOrder]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const resp = await apiFetch('/api/products');
      if (!resp.ok) throw new Error('Erreur chargement produits');
      const payload = await resp.json();
      setProducts(payload.data || []);
    } catch (err) {
      console.error('Fetch products error', err);
      toast.error('❌ Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const resp = await apiFetch('/api/categories');
      if (!resp.ok) throw new Error('Erreur chargement categories');
      const payload = await resp.json();
      setCategories(payload.data || []);
    } catch (err) {
      console.error('Fetch categories error', err);
      setCategories([]);
    }
  };

  const filterAndSortProducts = () => {
    let filtered = [...products];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (filterCategory !== "all") {
      filtered = filtered.filter(p => (p.category_id?.toString ? p.category_id.toString() : (p.category?.id?.toString ? p.category.id.toString() : '')) === filterCategory.toString());
    }

    // Stock filter
    if (filterStock === "in_stock") {
      filtered = filtered.filter(p => p.in_stock && p.stock > p.threshold);
    } else if (filterStock === "low_stock") {
      filtered = filtered.filter(p => p.stock <= p.threshold && p.stock > 0);
    } else if (filterStock === "out_of_stock") {
      filtered = filtered.filter(p => !p.in_stock || p.stock === 0);
    }

    // Status filter
    if (filterStatus === "active") {
      filtered = filtered.filter(p => p.active);
    } else if (filterStatus === "inactive") {
      filtered = filtered.filter(p => !p.active);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle nested properties
      if (sortBy === 'category') {
        aValue = a.category?.name;
        bValue = b.category?.name;
      }

      if (sortBy === 'price') {
        aValue = Number(a.price) || 0;
        bValue = Number(b.price) || 0;
      }

      if (sortBy === 'stock') {
        aValue = Number(a.stock) || 0;
        bValue = Number(b.stock) || 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortOrder === 'asc'
        ? (aValue > bValue ? 1 : -1)
        : (bValue > aValue ? 1 : -1);
    });

    setFilteredProducts(filtered);
    setCurrentPage(1);
  };

  const handleSave = async (productData: any) => {
    const token = localStorage.getItem('sessionToken');
    try {
      let resp;
      if (editingProduct) {
        resp = await apiFetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(productData)
        });
      } else {
        resp = await apiFetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(productData)
        });
      }

      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = payload.error || payload.message || `Erreur (${resp.status})`;
        throw new Error(msg);
      }

      toast.success(editingProduct ? '✅ Produit modifié avec succès' : '✅ Produit ajouté avec succès', {
        description: editingProduct ? 'Les modifications ont été enregistrées' : 'Le nouveau produit est disponible'
      });
      
      await fetchProducts();
    } catch (err) {
      console.error('Save product error', err);
      toast.error('❌ Erreur lors de la sauvegarde', {
        description: (err as Error).message || 'Veuillez réessayer'
      });
      throw err;
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setOpen(true);
  };

  const handleDuplicate = async (product: any) => {
    const duplicatedProduct = {
      ...product,
      id: undefined,
      name: `${product.name} (Copie)`,
      sku: product.sku ? `${product.sku}-COPY` : null,
      created_at: undefined,
      updated_at: undefined
    };
    
    setEditingProduct(duplicatedProduct);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.")) return;
    
    const token = localStorage.getItem('sessionToken');
    try {
      const resp = await fetch(`/api/products/${id}`, { 
        method: 'DELETE', 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      if (!resp.ok) throw new Error('Erreur lors de la suppression');
      
      toast.success('🗑️ Produit supprimé', {
        description: 'Le produit a été supprimé avec succès'
      });
      
      fetchProducts();
    } catch (err) {
      console.error('Delete product error', err);
      toast.error('❌ Erreur lors de la suppression', {
        description: (err as Error).message || 'Impossible de supprimer le produit'
      });
    }
  };

  const handleBulkAction = async (action: 'delete' | 'toggle_active' | 'toggle_featured') => {
    if (bulkSelected.length === 0) {
      toast.warning("Aucun produit sélectionné");
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
            resp = await fetch(`/api/products/${id}`, { 
              method: 'DELETE', 
              headers: { Authorization: `Bearer ${token}` } 
            });
            break;
          
          case 'toggle_active':
            const product = products.find(p => p.id === id);
            if (product) {
              resp = await apiFetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ active: !product.active })
              });
            }
            break;
          
          case 'toggle_featured':
            const featuredProduct = products.find(p => p.id === id);
            if (featuredProduct) {
              resp = await apiFetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ featured: !featuredProduct.featured })
              });
            }
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
    fetchProducts();
  };

  const handleExport = () => {
    exportProductsToCSV(filteredProducts);
    toast.success("📄 Export CSV réussi", {
      description: `${filteredProducts.length} produits exportés`
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedProducts = await parseCSVFile(file);
      
      if (importedProducts.length === 0) {
        toast.error("❌ Aucun produit à importer");
        return;
      }

      // Import products one by one
      let successCount = 0;
      let errorCount = 0;

      const token = localStorage.getItem('sessionToken');
      for (const product of importedProducts) {
        try {
          const resp = await apiFetch('/api/products', { 
            method: 'POST', 
            headers: { 
              'Content-Type': 'application/json', 
              Authorization: `Bearer ${token}` 
            }, 
            body: JSON.stringify(product) 
          });
          
          if (!resp.ok) {
            errorCount++;
            console.error('Error importing product', await resp.text());
          } else {
            successCount++;
          }
        } catch (err) {
          errorCount++;
          console.error('Import product error', err, product.name);
        }
      }

      toast.success(`${successCount} produits importés, ${errorCount} erreurs`);
      fetchProducts();
    } catch (error) {
      toast.error("❌ Erreur lors de l'import CSV", {
        description: 'Vérifiez le format du fichier'
      });
      console.error(error);
    }

    e.target.value = "";
  };

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter(p => p.active).length;
    const featured = products.filter(p => p.featured).length;
    const lowStock = products.filter(p => p.stock <= p.threshold && p.stock > 0).length;
    const outOfStock = products.filter(p => !p.in_stock || p.stock === 0).length;
    const totalValue = products.reduce((sum, p) => sum + (Number(p.price) || 0) * (p.stock || 0), 0);
    const categoriesCount = [...new Set(products.map(p => p.category?.id).filter(Boolean))].length;

    return { total, active, featured, lowStock, outOfStock, totalValue, categoriesCount };
  }, [products]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (bulkSelected.length === currentProducts.length) {
      setBulkSelected([]);
    } else {
      setBulkSelected(currentProducts.map(p => p.id));
    }
  };

  const getStockStatus = (product: any) => {
    if (!product.in_stock || product.stock === 0) return { label: "Rupture", color: "bg-red-100 text-red-800" };
    if (product.stock <= product.threshold) return { label: "Stock faible", color: "bg-orange-100 text-orange-800" };
    return { label: "En stock", color: "bg-green-100 text-green-800" };
  };

  const getStockPercentage = (product: any) => {
    if (!product.threshold) return 0;
    return Math.min(100, (product.stock / product.threshold) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gestion des Produits</h1>
              <p className="text-muted-foreground mt-1">
                Gérez votre catalogue de produits ({stats.total} produits)
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={fetchProducts} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={() => { setEditingProduct(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau produit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total produits</p>
                <p className="text-3xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.active} actifs
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valeur du stock</p>
                <p className="text-3xl font-bold">{stats.totalValue.toLocaleString()} FCFA</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Valeur totale
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alertes stock</p>
                <p className="text-3xl font-bold text-orange-600">{stats.lowStock}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.outOfStock} rupture{stats.outOfStock !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Produits vedettes</p>
                <p className="text-3xl font-bold text-purple-600">{stats.featured}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.categoriesCount} catégorie{stats.categoriesCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Star className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(stats.lowStock > 0 || stats.outOfStock > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <h3 className="font-semibold text-orange-900">Surveillance des stocks</h3>
                  <p className="text-sm text-orange-700">
                    {stats.lowStock > 0 && `${stats.lowStock} produit(s) sous le seuil d'alerte`}
                    {stats.lowStock > 0 && stats.outOfStock > 0 && ' • '}
                    {stats.outOfStock > 0 && `${stats.outOfStock} produit(s) en rupture de stock`}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setFilterStock('low_stock')}
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                Voir les alertes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Rechercher un produit (nom, SKU, description...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px] h-11">
                  <Layers className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterStock} onValueChange={setFilterStock}>
                <SelectTrigger className="w-[160px] h-11">
                  <PackageOpen className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les stocks</SelectItem>
                  <SelectItem value="in_stock">En stock</SelectItem>
                  <SelectItem value="low_stock">Stock faible</SelectItem>
                  <SelectItem value="out_of_stock">Rupture</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-11">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                  className="h-11 w-11"
                >
                  {viewMode === 'list' ? <Grid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-11 w-11">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Trier par</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => { setSortBy('name'); setSortOrder('asc'); }}>
                      Nom (A-Z)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortBy('name'); setSortOrder('desc'); }}>
                      Nom (Z-A)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortBy('price'); setSortOrder('asc'); }}>
                      Prix (Croissant)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortBy('price'); setSortOrder('desc'); }}>
                      Prix (Décroissant)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortBy('stock'); setSortOrder('asc'); }}>
                      Stock (Croissant)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortBy('stock'); setSortOrder('desc'); }}>
                      Stock (Décroissant)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Colonnes</DropdownMenuLabel>
                    {Object.entries(visibleColumns).map(([key, value]) => (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={value}
                        onCheckedChange={(checked) => 
                          setVisibleColumns(prev => ({ ...prev, [key]: !!checked }))
                        }
                      >
                        {key === 'image' && 'Image'}
                        {key === 'sku' && 'SKU'}
                        {key === 'name' && 'Nom'}
                        {key === 'category' && 'Catégorie'}
                        {key === 'price' && 'Prix'}
                        {key === 'stock' && 'Stock'}
                        {key === 'status' && 'Statut'}
                        {key === 'featured' && 'Vedette'}
                        {key === 'sales' && 'Ventes'}
                        {key === 'updated' && 'Mis à jour'}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{bulkSelected.length} produit{bulkSelected.length !== 1 ? 's' : ''} sélectionné{bulkSelected.length !== 1 ? 's' : ''}</h3>
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
                    <DropdownMenuItem onClick={() => handleBulkAction('toggle_active')}>
                      Basculer actif/inactif
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('toggle_featured')}>
                      Basculer vedette
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

      {/* Import/Export Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {filteredProducts.length} produit{filteredProducts.length !== 1 ? 's' : ''} trouvé{filteredProducts.length !== 1 ? 's' : ''}
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
            id="csv-import"
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => document.getElementById('csv-import')?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importer CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des produits</CardTitle>
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
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Aucun produit trouvé</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || filterCategory !== "all" || filterStock !== "all" 
                  ? 'Aucun produit ne correspond à vos critères'
                  : 'Commencez par créer votre premier produit'
                }
              </p>
              {!searchTerm && filterCategory === "all" && filterStock === "all" && (
                <Button onClick={() => { setEditingProduct(null); setOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un produit
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
                            checked={currentProducts.length > 0 && bulkSelected.length === currentProducts.length}
                            onChange={toggleSelectAll}
                            className="rounded"
                          />
                        </div>
                      </TableHead>
                      {visibleColumns.image && <TableHead className="w-16">Image</TableHead>}
                      {visibleColumns.sku && <TableHead>SKU</TableHead>}
                      <TableHead>Nom</TableHead>
                      {visibleColumns.category && <TableHead>Catégorie</TableHead>}
                      {visibleColumns.price && <TableHead>Prix</TableHead>}
                      {visibleColumns.stock && <TableHead>Stock</TableHead>}
                      {visibleColumns.status && <TableHead>Statut</TableHead>}
                      {visibleColumns.featured && <TableHead>Vedette</TableHead>}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentProducts.map((product) => {
                      const stockStatus = getStockStatus(product);
                      const stockPercentage = getStockPercentage(product);
                      const priceNum = Number(product.price) || 0;
                      const imgSrc = product.image_url || (product.images?.[0]?.url);

                      return (
                        <TableRow key={product.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={bulkSelected.includes(product.id)}
                                onChange={() => toggleBulkSelect(product.id)}
                                className="rounded"
                              />
                            </div>
                          </TableCell>
                          
                          {visibleColumns.image && (
                            <TableCell>
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                                {imgSrc ? (
                                  <img
                                    src={imgSrc}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                            </TableCell>
                          )}

                          {visibleColumns.sku && (
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {product.sku || "N/A"}
                              </code>
                            </TableCell>
                          )}

                          <TableCell>
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {product.description?.substring(0, 60)}...
                              </div>
                              {!product.active && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  Inactif
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {visibleColumns.category && (
                            <TableCell>
                              {product.category ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  {product.category.name}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}

                          {visibleColumns.price && (
                            <TableCell>
                              <div className="font-bold">{priceNum.toLocaleString()} FCFA</div>
                              {product.compare_price && (
                                <div className="text-xs text-muted-foreground line-through">
                                  {Number(product.compare_price).toLocaleString()} FCFA
                                </div>
                              )}
                            </TableCell>
                          )}

                          {visibleColumns.stock && (
                            <TableCell>
                              <div className="space-y-1">
                                <div className="text-sm font-medium">{product.stock || 0}</div>
                                <div className="flex items-center gap-2">
                                  <Progress value={stockPercentage} className="h-1.5 flex-1" />
                                  <span className="text-xs text-muted-foreground">
                                    {product.threshold || 0}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                          )}

                          {visibleColumns.status && (
                            <TableCell>
                              <Badge className={stockStatus.color}>
                                {stockStatus.label}
                              </Badge>
                            </TableCell>
                          )}

                          {visibleColumns.featured && (
                            <TableCell>
                              {product.featured ? (
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}

                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(product)}
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
                                  <DropdownMenuItem onClick={() => handleEdit(product)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Modifier
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDuplicate(product)}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Dupliquer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => window.open(`/produit/${product.id}`, '_blank')}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Voir sur le site
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(product.id)}
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
                    Affichage de {startIndex + 1} à {Math.min(endIndex, filteredProducts.length)} sur {filteredProducts.length} produits
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

      {/* Product Modal */}
      <ProductModal
        open={open}
        onOpenChange={(open) => { setOpen(open); if (!open) setEditingProduct(null); }}
        product={editingProduct}
        categories={categories}
        onSave={handleSave}
      />
    </div>
  );
};

export default Products;