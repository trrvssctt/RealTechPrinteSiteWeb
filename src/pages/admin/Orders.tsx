import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiFetch } from '@/lib/api';
import { Eye, Download } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const Orders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch('/api/admin/orders', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) throw new Error('failed');
      const payload = await resp.json();
      setOrders(payload.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement');
    }
  };

  // order items are returned aggregated with the order in the admin list

  const handleViewDetails = async (order: any) => {
    setSelectedOrder(order);
    setOrderItems(order.items || []);
    setDetailsOpen(true);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await apiFetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {}),
        body: JSON.stringify({ status: newStatus })
      });
      if (!resp.ok) throw new Error('failed');
      toast.success('Statut mis à jour');
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const exportToPDF = (order: any) => {
    toast.info("Fonctionnalité d'export PDF à venir");
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      processing: "bg-purple-100 text-purple-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800"
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "En attente",
      confirmed: "Confirmée",
      processing: "En traitement",
      completed: "Terminée",
      cancelled: "Annulée"
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestion des Commandes</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Commande</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.order_number || (order.id ? order.id.substring(0, 8) : '')}</TableCell>
                <TableCell>{(order.metadata && order.metadata.customer && order.metadata.customer.name) || order.customer_name || 'N/A'}</TableCell>
                <TableCell>{(order.metadata && order.metadata.customer && order.metadata.customer.phone) || order.customer_phone || 'N/A'}</TableCell>
                <TableCell>{Number(order.total_amount).toLocaleString()} FCFA</TableCell>
                <TableCell>
                  <Select
                    value={order.status}
                    onValueChange={(value) => handleStatusChange(order.id, value)}
                  >
                    <SelectTrigger className={`w-32 ${getStatusColor(order.status)}`}>
                      <SelectValue>{getStatusLabel(order.status)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Confirmée</SelectItem>
                      <SelectItem value="processing">En traitement</SelectItem>
                      <SelectItem value="completed">Terminée</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {format(new Date(order.placed_at || order.created_at || Date.now()), "dd MMM yyyy", { locale: fr })}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetails(order)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportToPDF(order)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la commande {selectedOrder?.order_number || (selectedOrder?.id ? selectedOrder.id.substring(0,8) : '')}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Client</p>
                  <p className="text-sm text-muted-foreground">{(selectedOrder.metadata && selectedOrder.metadata.customer && selectedOrder.metadata.customer.name) || selectedOrder.customer_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Téléphone</p>
                  <p className="text-sm text-muted-foreground">{(selectedOrder.metadata && selectedOrder.metadata.customer && selectedOrder.metadata.customer.phone) || selectedOrder.customer_phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{(selectedOrder.metadata && selectedOrder.metadata.customer && selectedOrder.metadata.customer.email) || selectedOrder.customer_email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Statut</p>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <p className="text-sm font-medium">Notes</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Produits</p>
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
                    {orderItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name || item.product_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{Number(item.unit_price || item.unit_price).toLocaleString()} FCFA</TableCell>
                        <TableCell>{Number(item.total || item.total_price || 0).toLocaleString()} FCFA</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end border-t pt-4">
                <div className="text-right">
                  <p className="text-sm font-medium">Total</p>
                  <p className="text-2xl font-bold">{Number(selectedOrder.total_amount).toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;