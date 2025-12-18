import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiFetch } from '@/lib/api';
import { Plus, Pencil, Trash2, Copy, ExternalLink, Upload, Download, Search, AlertTriangle } from "lucide-react";
import { ProductModal } from "@/components/admin/ProductModal";
import { exportProductsToCSV, parseCSVFile } from "@/utils/csvUtils";

const Products = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStock, setFilterStock] = useState("all");

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterProductsList();
  }, [products, searchTerm, filterCategory, filterStock]);

  const fetchProducts = async () => {
    try {
      const resp = await apiFetch('/api/products');
      if (!resp.ok) throw new Error('Erreur chargement produits');
      const payload = await resp.json();
      setProducts(payload.data || []);
    } catch (err) {
      console.error('Fetch products error', err);
      toast.error('Erreur lors du chargement des produits');
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

  const filterProductsList = () => {
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

    setFilteredProducts(filtered);
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

      toast.success(editingProduct ? 'Produit modifié avec succès' : 'Produit ajouté avec succès');
      await fetchProducts();
    } catch (err) {
      console.error('Save product error', err);
      toast.error((err as Error).message || 'Erreur lors de la sauvegarde');
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
    
    setEditingProduct(null);
    setOpen(true);
    // Wait a bit for modal to open then set the product data
    setTimeout(() => setEditingProduct(duplicatedProduct), 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;
    const token = localStorage.getItem('sessionToken');
    try {
      const resp = await fetch(`/api/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('Erreur lors de la suppression');
      toast.success('Produit supprimé');
      fetchProducts();
    } catch (err) {
      console.error('Delete product error', err);
      toast.error((err as Error).message || 'Erreur lors de la suppression');
    }
  };

  const handleExport = () => {
    exportProductsToCSV(products);
    toast.success("Export CSV réussi");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedProducts = await parseCSVFile(file);
      
      if (importedProducts.length === 0) {
        toast.error("Aucun produit à importer");
        return;
      }

      // Import products one by one
      let successCount = 0;
      let errorCount = 0;

      const token = localStorage.getItem('sessionToken');
      for (const product of importedProducts) {
        try {
          const resp = await apiFetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(product) });
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
      toast.error("Erreur lors de l'import CSV");
      console.error(error);
    }

    e.target.value = ""; // Reset input
  };

  const lowStockCount = products.filter(p => p.stock <= p.threshold && p.stock > 0).length;
  const outOfStockCount = products.filter(p => !p.in_stock || p.stock === 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Produits</h1>
          <p className="text-muted-foreground mt-1">
            {products.length} produits · {lowStockCount} alertes stock · {outOfStockCount} ruptures
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
            id="csv-import"
          />
          <Button variant="outline" onClick={() => document.getElementById('csv-import')?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Importer CSV
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exporter CSV
          </Button>
          <Button onClick={() => { setEditingProduct(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau produit
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="flex gap-4">
          {lowStockCount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-3 flex-1">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-semibold text-orange-900">Stock faible</p>
                <p className="text-sm text-orange-700">{lowStockCount} produit(s) sous le seuil d'alerte</p>
              </div>
            </div>
          )}
          {outOfStockCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 flex-1">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Rupture de stock</p>
                <p className="text-sm text-red-700">{outOfStockCount} produit(s) en rupture</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, SKU ou description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[200px]">
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les stocks</SelectItem>
            <SelectItem value="in_stock">En stock</SelectItem>
            <SelectItem value="low_stock">Stock faible</SelectItem>
            <SelectItem value="out_of_stock">Rupture</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Prix TTC</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Aucun produit trouvé
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const isLowStock = product.stock <= product.threshold && product.stock > 0;
                const isOutOfStock = !product.in_stock || product.stock === 0;
                
                const imgSrc = product.image_url || (product.images && product.images[0]?.url);
                const priceNum = Number(product.price) || 0;

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={product.name}
                          className="h-12 w-12 object-cover rounded"
                        />
                      ) : (
                        <div className="h-12 w-12 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                          No img
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{product.sku || "-"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      {product.featured && (
                        <Badge variant="secondary" className="mt-1">⭐ Vedette</Badge>
                      )}
                    </TableCell>
                    <TableCell>{product.category?.name || "-"}</TableCell>
                    <TableCell className="font-semibold">{priceNum.toLocaleString()} FCFA</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className={isLowStock ? "text-orange-600 font-semibold" : isOutOfStock ? "text-red-600 font-semibold" : ""}>
                          {product.stock}
                        </span>
                        <span className="text-muted-foreground"> / {product.threshold}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isOutOfStock ? (
                        <Badge variant="destructive">Rupture</Badge>
                      ) : isLowStock ? (
                        <Badge className="bg-orange-500">Stock faible</Badge>
                      ) : (
                        <Badge className="bg-green-600">En stock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(product)}
                          title="Dupliquer"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/produit/${product.id}`, '_blank')}
                          title="Voir sur le site"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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