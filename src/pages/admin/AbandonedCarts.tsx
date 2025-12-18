import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Trash2, ShoppingCart, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from '@/lib/api';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type CartItem = {
  id?: string;
  product_id?: string;
  name?: string;
  quantity?: number;
  price?: number;
};

type Cart = {
  id: string;
  session_id: string;
  user_id: string | null;
  items: CartItem[];
  total_amount: number;
  status: string;
  last_activity_at: string;
  created_at: string;
};

const AbandonedCarts = () => {
  const [allCarts, setAllCarts] = useState<Cart[]>([]);
  const [filter, setFilter] = useState<"all" | "abandoned" | "active">("all");
  const [loading, setLoading] = useState(true);
  // displayed carts after applying filter
  const [carts, setCarts] = useState<Cart[]>([]);

  useEffect(() => {
    fetchCarts();
  }, [filter]);

  const fetchCarts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/carts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resp.ok) {
        throw new Error('Failed to load carts');
      }
      const payload = await resp.json();
      const raw = (payload.data || []).map((cart: any) => ({
        ...cart,
        items: Array.isArray(cart.items) ? cart.items : [],
        total_amount: cart.total_amount || 0,
        last_activity_at: cart.last_activity_at || cart.updated_at || cart.created_at || null,
      }));

      setAllCarts(raw as Cart[]);

      // apply filter to derive displayed carts
      let filtered = raw;
      if (filter === 'abandoned') {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        filtered = raw.filter((c: any) => c.last_activity_at && new Date(c.last_activity_at).getTime() < twoHoursAgo && c.status === 'active');
      } else if (filter === 'active') {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        filtered = raw.filter((c: any) => c.last_activity_at && new Date(c.last_activity_at).getTime() >= twoHoursAgo && c.status === 'active');
      }

      setCarts(filtered as Cart[]);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des paniers');
    }
    setLoading(false);
  };

  const handleWhatsAppReminder = (cart: Cart) => {
    const products = cart.items.map((item: any) => `${item.name} (x${item.quantity})`).join(", ");
    const message = `Bonjour ! Vous avez laissé des articles dans votre panier : ${products}. Total : ${cart.total_amount.toLocaleString()} FCFA. Souhaitez-vous finaliser votre commande ?`;
    const whatsappUrl = `https://wa.me/221774220320?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
    toast.success("Message WhatsApp préparé");
  };

  const handleDelete = async (cartId: string) => {
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch(`/api/admin/carts/${cartId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resp.ok) throw new Error('delete failed');
      toast.success('Panier supprimé');
      fetchCarts();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const isAbandoned = (lastActivity: string) => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    return new Date(lastActivity).getTime() < twoHoursAgo;
  };

  const stats = {
    totalCarts: allCarts.length,
    totalValue: allCarts.reduce((sum, cart) => sum + Number(cart.total_amount || 0), 0),
    abandonedCount: allCarts.filter(cart => cart.last_activity_at && isAbandoned(cart.last_activity_at)).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paniers Abandonnés</h1>
        <p className="text-muted-foreground mt-2">Récupérez les ventes perdues</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paniers actifs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCarts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paniers abandonnés</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.abandonedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valeur totale</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalValue.toLocaleString()} FCFA</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des paniers</CardTitle>
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="abandoned">Abandonnés</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Chargement...</p>
          ) : carts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Aucun panier trouvé</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Produits</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Dernière activité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carts.map((cart) => {
                  const abandoned = isAbandoned(cart.last_activity_at);
                  return (
                    <TableRow key={cart.id}>
                      <TableCell className="font-mono text-xs">
                        {cart.session_id ? `${cart.session_id.substring(0, 12)}...` : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {cart.items.slice(0, 2).map((item: any, idx: number) => (
                            <div key={idx} className="text-sm">
                              {item.name} (x{item.quantity})
                            </div>
                          ))}
                          {cart.items.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{cart.items.length - 2} autre(s)
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {Number(cart.total_amount).toLocaleString()} FCFA
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{cart.session_id ? cart.session_id.substring(0, 12) : '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {cart.last_activity_at ? format(new Date(cart.last_activity_at), "dd MMM yyyy HH:mm", { locale: fr }) : '—'}
                      </TableCell>
                      <TableCell>
                        {abandoned ? (
                          <Badge variant="destructive">Abandonné</Badge>
                        ) : (
                          <Badge variant="default">Actif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWhatsAppReminder(cart)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(cart.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AbandonedCarts;
