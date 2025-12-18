import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ContactInfo = () => {
  const [loading, setLoading] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    facebook_url: "",
    instagram_url: ""
  });

  useEffect(() => {
    fetchContactInfo();
  }, []);

  const fetchContactInfo = async () => {
    const { data, error } = await supabase
      .from("contact_info")
      .select("*")
      .maybeSingle();
    
    if (error) {
      toast.error("Erreur lors du chargement");
    } else if (data) {
      setContactId(data.id);
      setFormData({
        phone: data.phone || "",
        whatsapp: data.whatsapp || "",
        email: data.email || "",
        address: data.address || "",
        facebook_url: data.facebook_url || "",
        instagram_url: data.instagram_url || ""
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (contactId) {
        const { error } = await supabase
          .from("contact_info")
          .update(formData)
          .eq("id", contactId);

        if (error) throw error;
        toast.success("Informations mises à jour avec succès");
      } else {
        const { error } = await supabase
          .from("contact_info")
          .insert([formData]);

        if (error) throw error;
        toast.success("Informations ajoutées avec succès");
        await fetchContactInfo();
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Informations de Contact</h1>
        <p className="text-muted-foreground mt-2">
          Gérez les coordonnées de votre entreprise affichées sur le site
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coordonnées de l'entreprise</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facebook_url">Facebook URL</Label>
                <Input
                  id="facebook_url"
                  type="url"
                  value={formData.facebook_url}
                  onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram_url">Instagram URL</Label>
                <Input
                  id="instagram_url"
                  type="url"
                  value={formData.instagram_url}
                  onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer les modifications
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactInfo;