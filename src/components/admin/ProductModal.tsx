import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductImageUpload } from "./ProductImageUpload";
import { ProductPreview } from "./ProductPreview";
import { Loader2, Save } from "lucide-react";

interface ProductImage {
  url: string;
  alt: string;
  order: number;
  is_primary: boolean;
}

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  categories: any[];
  onSave: (data: any) => Promise<void>;
}

export const ProductModal = ({ open, onOpenChange, product, categories, onSave }: ProductModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category_id: "",
    short_description: "",
    description: "",
    price_ht: "",
    tva_rate: "18",
    price: "",
    stock: "0",
    threshold: "5",
    in_stock: true,
    featured: false,
    tags: [] as string[],
    images: [] as ProductImage[]
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        category_id: product.category_id || "",
        short_description: product.short_description || "",
        description: product.description || "",
        price_ht: product.price_ht?.toString() || "",
        tva_rate: product.tva_rate?.toString() || "18",
        price: product.price?.toString() || "",
        stock: product.stock?.toString() || "0",
        threshold: product.threshold?.toString() || "5",
        in_stock: product.in_stock ?? true,
        featured: product.featured || false,
        tags: product.tags || [],
        images: product.images || (product.image_url ? [{ url: product.image_url, alt: product.name, order: 0, is_primary: true }] : [])
      });
    } else {
      setFormData({
        name: "",
        sku: "",
        category_id: "",
        short_description: "",
        description: "",
        price_ht: "",
        tva_rate: "18",
        price: "",
        stock: "0",
        threshold: "5",
        in_stock: true,
        featured: false,
        tags: [],
        images: []
      });
    }
  }, [product, open]);

  // Auto-calculate price TTC from HT
  useEffect(() => {
    if (formData.price_ht && formData.tva_rate) {
      const ht = parseFloat(formData.price_ht);
      const tva = parseFloat(formData.tva_rate);
      if (!isNaN(ht) && !isNaN(tva)) {
        const ttc = ht * (1 + tva / 100);
        setFormData(prev => ({ ...prev, price: ttc.toFixed(0) }));
      }
    }
  }, [formData.price_ht, formData.tva_rate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        price_ht: formData.price_ht ? parseFloat(formData.price_ht) : null,
        tva_rate: formData.tva_rate ? parseFloat(formData.tva_rate) : 18,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        threshold: parseInt(formData.threshold),
        slug: formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
        image_url: formData.images.find(img => img.is_primary)?.url || formData.images[0]?.url || null
      };

      await onSave(submitData);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving product:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto flex gap-6 pb-28">
          {/* Left side - Form */}
          <div className="flex-1 overflow-y-auto pr-4">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">Général</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="stock">Stock & Prix</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du produit *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">Référence (SKU)</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="RT-XXX-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Catégorie *</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="short_description">Description courte</Label>
                  <Textarea
                    id="short_description"
                    value={formData.short_description}
                    onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                    rows={2}
                    placeholder="Description affichée sur la carte produit"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description détaillée</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    placeholder="Description complète du produit"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="in_stock"
                      checked={formData.in_stock}
                      onCheckedChange={(checked) => setFormData({ ...formData, in_stock: checked })}
                    />
                    <Label htmlFor="in_stock">En stock</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="featured"
                      checked={formData.featured}
                      onCheckedChange={(checked) => setFormData({ ...formData, featured: checked })}
                    />
                    <Label htmlFor="featured">Produit vedette</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="images" className="space-y-4 mt-4">
                <ProductImageUpload
                  images={formData.images}
                  onChange={(images) => setFormData({ ...formData, images })}
                />
              </TabsContent>

              <TabsContent value="stock" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price_ht">Prix HT (FCFA)</Label>
                    <Input
                      id="price_ht"
                      type="number"
                      value={formData.price_ht}
                      onChange={(e) => setFormData({ ...formData, price_ht: e.target.value })}
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tva_rate">TVA (%)</Label>
                    <Input
                      id="tva_rate"
                      type="number"
                      value={formData.tva_rate}
                      onChange={(e) => setFormData({ ...formData, tva_rate: e.target.value })}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Prix TTC (FCFA) *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Calculé automatiquement si Prix HT renseigné
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock actuel</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="threshold">Seuil d'alerte</Label>
                    <Input
                      id="threshold"
                      type="number"
                      value={formData.threshold}
                      onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                      min="0"
                    />
                  </div>
                </div>

                {parseInt(formData.stock) <= parseInt(formData.threshold) && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    <p className="text-sm text-destructive font-medium">
                      ⚠️ Stock faible : Le stock est en dessous du seuil d'alerte
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right side - Preview */}
          <div className="w-[350px] border-l pl-6 overflow-y-auto">
            <h3 className="font-semibold mb-4">Aperçu</h3>
            <ProductPreview data={formData} />
          </div>

          {/* Footer buttons */}
          <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
