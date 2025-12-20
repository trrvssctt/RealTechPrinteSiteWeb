import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { apiFetch } from '@/lib/api';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Image as ImageIcon, 
  Search, 
  Filter,
  Package,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileImage,
  FolderTree,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Categories = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<any[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    image_url: "",
    is_featured: false,
    meta_title: "",
    meta_description: ""
  });

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCategories(categories);
    } else {
      const filtered = categories.filter(category =>
        category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.slug.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCategories(filtered);
    }
    setCurrentPage(1);
  }, [categories, searchQuery]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const resp = await apiFetch('/api/categories');
      if (!resp.ok) throw new Error('Erreur chargement catégories');
      const payload = await resp.json();
      const sortedCategories = (payload.data || []).sort((a: any, b: any) => 
        new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
      );
      setCategories(sortedCategories);
      setFilteredCategories(sortedCategories);
    } catch (err) {
      toast.error('Erreur lors du chargement des catégories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const categoryData = {
      ...formData,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    };

    const token = localStorage.getItem('sessionToken');
    setSaving(true);
    try {
      let resp;
      if (editingCategory) {
        resp = await apiFetch(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(categoryData)
        });
      } else {
        resp = await apiFetch('/api/categories', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(categoryData)
        });
      }

      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = payload.error || payload.message || `Erreur (${resp.status})`;
        throw new Error(msg);
      }

      toast.success(editingCategory ? '✅ Catégorie modifiée avec succès' : '✅ Catégorie ajoutée avec succès', {
        description: editingCategory ? 'Les modifications ont été enregistrées' : 'La nouvelle catégorie est disponible'
      });
      setOpenDialog(false);
      await fetchCategories();
      resetForm();
    } catch (err) {
      console.error('Save category error', err);
      toast.error('❌ Erreur lors de la sauvegarde', {
        description: (err as Error).message || 'Veuillez réessayer'
      });
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
      image_url: category.image_url || "",
      is_featured: category.is_featured || false,
      meta_title: category.meta_title || "",
      meta_description: category.meta_description || ""
    });
    setOpenDialog(true);
  };

  const confirmDelete = (category: any) => {
    setCategoryToDelete(category);
    setOpenDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    
    const token = localStorage.getItem('sessionToken');
    try {
      const resp = await apiFetch(`/api/categories/${categoryToDelete.id}`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (!resp.ok) throw new Error('Erreur lors de la suppression');
      
      toast.success('🗑️ Catégorie supprimée', {
        description: `${categoryToDelete.name} a été supprimée avec succès`
      });
      
      fetchCategories();
    } catch (err) {
      toast.error('❌ Erreur lors de la suppression', {
        description: (err as Error).message || 'Impossible de supprimer cette catégorie'
      });
    } finally {
      setOpenDeleteDialog(false);
      setCategoryToDelete(null);
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      image_url: "",
      is_featured: false,
      meta_title: "",
      meta_description: ""
    });
  };

  const handleImagePreview = () => {
    if (formData.image_url) {
      window.open(formData.image_url, '_blank');
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredCategories.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentCategories = filteredCategories.slice(startIndex, endIndex);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <FolderTree className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gestion des Catégories</h1>
              <p className="text-muted-foreground mt-1">
                Gérez les catégories de vos produits ({categories.length} catégories)
              </p>
            </div>
          </div>
        </div>
        
        <Dialog open={openDialog} onOpenChange={(open) => { 
          setOpenDialog(open); 
          if (!open) resetForm(); 
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle catégorie
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">
                {editingCategory ? (
                  <span className="flex items-center gap-2">
                    <Pencil className="h-5 w-5" />
                    Modifier la catégorie
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Nouvelle catégorie
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>
                {editingCategory 
                  ? "Modifiez les informations de la catégorie" 
                  : "Ajoutez une nouvelle catégorie pour organiser vos produits"}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      Nom de la catégorie *
                      {formData.name && (
                        <Badge variant="outline" className="text-xs">
                          {formData.name.length}/50
                        </Badge>
                      )}
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Électronique, Mode, Maison..."
                      maxLength={50}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug" className="flex items-center gap-2">
                      Slug
                      <Badge variant="secondary" className="text-xs">
                        URL
                      </Badge>
                    </Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="Sera généré automatiquement"
                      className="h-11 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Utilisé dans l'URL. Ex: "electronique" pour https://site.com/categories/electronique
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="image_url">Image de la catégorie</Label>
                      {formData.image_url && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleImagePreview}
                          className="h-8 text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Prévisualiser
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="image_url"
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                        className="h-11"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11"
                        onClick={() => {
                          const url = prompt("Collez l'URL de l'image:");
                          if (url) setFormData({ ...formData, image_url: url });
                        }}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_featured"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="is_featured" className="text-sm font-medium">
                      Mettre en avant cette catégorie
                    </Label>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="description" className="flex items-center gap-2">
                      Description
                      {formData.description && (
                        <Badge variant="outline" className="text-xs">
                          {formData.description.length}/500
                        </Badge>
                      )}
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Décrivez cette catégorie..."
                      rows={5}
                      maxLength={500}
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* SEO Section */}
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Optimisation SEO (optionnel)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="meta_title">Titre SEO</Label>
                    <Input
                      id="meta_title"
                      value={formData.meta_title}
                      onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                      placeholder="Titre pour les moteurs de recherche"
                      maxLength={60}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meta_description">Description SEO</Label>
                    <Textarea
                      id="meta_description"
                      value={formData.meta_description}
                      onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                      placeholder="Description pour les moteurs de recherche"
                      rows={3}
                      maxLength={160}
                      className="resize-none h-20"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpenDialog(false)}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingCategory ? 'Modification...' : 'Enregistrement...'}
                    </>
                  ) : editingCategory ? (
                    <>
                      <Pencil className="mr-2 h-4 w-4" />
                      Modifier la catégorie
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Créer la catégorie
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">{categories.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FolderTree className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En vedette</p>
                <p className="text-3xl font-bold">
                  {categories.filter(c => c.is_featured).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Package className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avec image</p>
                <p className="text-3xl font-bold">
                  {categories.filter(c => c.image_url).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileImage className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sans description</p>
                <p className="text-3xl font-bold">
                  {categories.filter(c => !c.description).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center">
                <FileImage className="h-6 w-6 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Rechercher une catégorie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-11">
                <Filter className="mr-2 h-4 w-4" />
                Filtrer
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={fetchCategories}
                className="h-11 w-11"
                disabled={loading}
              >
                <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des catégories</CardTitle>
          <CardDescription>
            {filteredCategories.length} catégorie{filteredCategories.length !== 1 ? 's' : ''} trouvée{filteredCategories.length !== 1 ? 's' : ''}
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
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FolderTree className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Aucune catégorie trouvée</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? 'Essayez une autre recherche' : 'Commencez par créer votre première catégorie'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setOpenDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer une catégorie
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16"></TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date de création</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentCategories.map((category) => (
                      <TableRow key={category.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="w-12 h-12 rounded-lg overflow-hidden border bg-gray-100 flex items-center justify-center">
                            {category.image_url ? (
                              <img
                                src={category.image_url}
                                alt={category.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).parentElement!.innerHTML = 
                                    '<div class="w-full h-full flex items-center justify-center bg-gray-200"><ImageIcon class="h-5 w-5 text-gray-400" /></div>';
                                }}
                              />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{category.name}</div>
                            <div className="text-xs text-muted-foreground">
                              ID: {(() => {
                                const idStr = category.id === undefined || category.id === null ? '' : String(category.id);
                                return idStr.length > 8 ? `${idStr.substring(0, 8)}...` : idStr || '-';
                              })()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {category.slug}
                          </code>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="truncate text-sm">
                            {category.description || (
                              <span className="text-muted-foreground italic">Aucune description</span>
                            )}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {category.created_at ? formatDate(category.created_at) : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {category.is_featured && (
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                Vedette
                              </Badge>
                            )}
                            {category.image_url ? (
                              <Badge variant="outline" className="border-blue-200 text-blue-700">
                                Avec image
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-gray-200 text-gray-700">
                                Sans image
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEdit(category)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(`/categories/${category.slug}`, '_blank')}>
                                <Eye className="mr-2 h-4 w-4" />
                                Voir sur le site
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => confirmDelete(category)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                    Affichage de {startIndex + 1} à {Math.min(endIndex, filteredCategories.length)} sur {filteredCategories.length} catégories
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
      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la catégorie <strong>"{categoryToDelete?.name}"</strong> ? 
              Cette action est irréversible et supprimera également tous les produits associés à cette catégorie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCategoryToDelete(null)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Categories;