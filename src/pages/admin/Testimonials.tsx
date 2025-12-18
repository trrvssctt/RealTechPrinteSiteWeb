import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";

const Testimonials = () => {
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<any>(null);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_role: "",
    content: "",
    rating: "5",
    avatar_url: "",
    is_active: true
  });

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const fetchTestimonials = async () => {
    const { data, error } = await supabase
      .from("testimonials")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Erreur lors du chargement");
    } else {
      setTestimonials(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const testimonialData = {
      ...formData,
      rating: parseInt(formData.rating)
    };

    if (editingTestimonial) {
      const { error } = await supabase
        .from("testimonials")
        .update(testimonialData)
        .eq("id", editingTestimonial.id);

      if (error) {
        toast.error("Erreur lors de la modification");
      } else {
        toast.success("Témoignage modifié avec succès");
        setOpen(false);
        fetchTestimonials();
        resetForm();
      }
    } else {
      const { error } = await supabase.from("testimonials").insert([testimonialData]);

      if (error) {
        toast.error("Erreur lors de l'ajout");
      } else {
        toast.success("Témoignage ajouté avec succès");
        setOpen(false);
        fetchTestimonials();
        resetForm();
      }
    }
  };

  const handleEdit = (testimonial: any) => {
    setEditingTestimonial(testimonial);
    setFormData({
      customer_name: testimonial.customer_name,
      customer_role: testimonial.customer_role || "",
      content: testimonial.content,
      rating: testimonial.rating?.toString() || "5",
      avatar_url: testimonial.avatar_url || "",
      is_active: testimonial.is_active
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce témoignage ?")) return;

    const { error } = await supabase.from("testimonials").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Témoignage supprimé");
      fetchTestimonials();
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("testimonials")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success("Statut mis à jour");
      fetchTestimonials();
    }
  };

  const resetForm = () => {
    setEditingTestimonial(null);
    setFormData({
      customer_name: "",
      customer_role: "",
      content: "",
      rating: "5",
      avatar_url: "",
      is_active: true
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestion des Témoignages</h1>
        <Dialog open={open} onOpenChange={(open) => { setOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un témoignage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTestimonial ? "Modifier le témoignage" : "Ajouter un témoignage"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Nom du client *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_role">Fonction / Entreprise</Label>
                <Input
                  id="customer_role"
                  value={formData.customer_role}
                  onChange={(e) => setFormData({ ...formData, customer_role: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Témoignage *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rating">Note (1-5)</Label>
                <Input
                  id="rating"
                  type="number"
                  min="1"
                  max="5"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar_url">URL de l'avatar</Label>
                <Input
                  id="avatar_url"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                Actif (visible sur le site)
              </label>

              <Button type="submit" className="w-full">
                {editingTestimonial ? "Modifier" : "Ajouter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avatar</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Fonction</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {testimonials.map((testimonial) => (
              <TableRow key={testimonial.id}>
                <TableCell>
                  {testimonial.avatar_url && (
                    <img
                      src={testimonial.avatar_url}
                      alt={testimonial.customer_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                </TableCell>
                <TableCell className="font-medium">{testimonial.customer_name}</TableCell>
                <TableCell>{testimonial.customer_role || "N/A"}</TableCell>
                <TableCell>{"⭐".repeat(testimonial.rating || 5)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive(testimonial.id, testimonial.is_active)}
                  >
                    {testimonial.is_active ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(testimonial)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(testimonial.id)}
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

export default Testimonials;