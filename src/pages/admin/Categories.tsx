import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from '@/lib/api';
import { Plus, Pencil, Trash2 } from "lucide-react";

const Categories = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    image_url: ""
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const resp = await apiFetch('/api/categories');
      if (!resp.ok) throw new Error('Erreur chargement catégories');
      const payload = await resp.json();
      setCategories(payload.data || []);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const categoryData = {
      ...formData,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-")
    };

    const token = localStorage.getItem('sessionToken');
    setSaving(true);
    try {
      let resp;
        if (editingCategory) {
        resp = await apiFetch(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: categoryData.name, slug: categoryData.slug, description: categoryData.description, image_url: categoryData.image_url })
        });
      } else {
        resp = await apiFetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: categoryData.name, slug: categoryData.slug, description: categoryData.description, image_url: categoryData.image_url })
        });
      }

      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = payload.error || payload.message || `Erreur (${resp.status})`;
        throw new Error(msg);
      }

      toast.success(editingCategory ? 'Catégorie modifiée avec succès' : 'Catégorie ajoutée avec succès');
      setOpen(false);
      await fetchCategories();
      resetForm();
    } catch (err) {
      console.error('Save category error', err);
      toast.error((err as Error).message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      image_url: category.image_url || ""
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;
    const token = localStorage.getItem('sessionToken');
    try {
      const resp = await apiFetch(`/api/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('Erreur lors de la suppression');
      toast.success('Catégorie supprimée');
      fetchCategories();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      image_url: ""
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestion des Catégories</h1>
        <Dialog open={open} onOpenChange={(open) => { setOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une catégorie
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Modifier la catégorie" : "Ajouter une catégorie"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Auto-généré si vide"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">URL de l'image</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (editingCategory ? 'Modification...' : 'Enregistrement...') : (editingCategory ? 'Modifier' : 'Ajouter')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  {category.image_url && (
                    <img
                      src={category.image_url}
                      alt={category.name}
                      className="h-12 w-12 object-cover rounded"
                    />
                  )}
                </TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>{category.slug}</TableCell>
                <TableCell className="max-w-xs truncate">{category.description}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(category)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(category.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Categories;