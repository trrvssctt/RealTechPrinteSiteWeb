import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

const Cart = () => {
  const { cart, removeFromCart, updateQuantity, totalPrice, clearCart } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const generateWhatsAppMessage = () => {
    const products = cart
      .map((item) => `- ${item.name} x${item.quantity} (${(item.price * item.quantity).toLocaleString('fr-FR')} FCFA)`)
      .join('\n');
    const message = `Bonjour, je souhaite commander :\n\n${products}\n\nTotal : ${totalPrice.toLocaleString('fr-FR')} FCFA`;
    return encodeURIComponent(message);
  };

  const whatsappLink = `https://wa.me/221774220320?text=${generateWhatsAppMessage()}`;

  const submitOrder = async () => {
    try {
      if (!customerName || !customerPhone) {
        toast.error('Veuillez renseigner votre nom et téléphone');
        return;
      }
      setSubmitting(true);
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        items: cart.map((i) => ({ product_id: i.product_id || null, product_name: i.name, unit_price: i.price, quantity: i.quantity })),
        total_amount: totalPrice,
      };
      const resp = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('order failed');
      const body = await resp.json();
      toast.success('Commande créée avec succès');
      clearCart();
      setCheckoutOpen(false);
      if (body?.data?.id) toast.success(`N° commande: ${body.data.id.substring(0, 8)}`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création de la commande');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart || cart.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center animate-fade-in">
            <ShoppingBag className="w-24 h-24 mx-auto text-muted-foreground mb-6" />
            <h1 className="text-3xl font-bold mb-4">Votre panier est vide</h1>
            <p className="text-muted-foreground mb-8">Découvrez nos produits et commencez vos achats</p>
            <Button size="lg" asChild>
              <Link to="/">Découvrir nos produits</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 animate-fade-in">Mon Panier</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item, index) => (
              <div
                key={item.id}
                className="card-elegant p-4 flex flex-col sm:flex-row gap-4 animate-scale-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <img src={item.image} alt={item.name} className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{item.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{item.category}</p>
                  <p className="text-xl font-bold text-primary">{item.price.toLocaleString('fr-FR')} FCFA</p>
                </div>
                <div className="flex flex-col justify-between items-end">
                  <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-12 text-center font-semibold">{item.quantity}</span>
                    <Button variant="outline" size="icon" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="card-elegant p-6 sticky top-24 animate-fade-in">
              <h2 className="text-2xl font-bold mb-6">Récapitulatif</h2>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-muted-foreground">
                  <span>Nombre d'articles</span>
                  <span className="font-semibold">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-2xl font-bold">
                    <span>Total</span>
                    <span className="text-primary">{totalPrice.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button variant="whatsapp" size="lg" className="w-full" asChild>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    Valider sur WhatsApp
                  </a>
                </Button>
                <Button variant="primary" size="lg" className="w-full" onClick={() => setCheckoutOpen(true)}>
                  Commander
                </Button>
                <Button variant="outline" size="lg" className="w-full" asChild>
                  <a href="tel:+221774220320">Appeler pour commander</a>
                </Button>
                <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={clearCart}>
                  Vider le panier
                </Button>
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note :</strong> Votre commande sera confirmée après validation sur WhatsApp ou par téléphone.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Checkout Dialog */}
        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Finaliser la commande</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Votre nom</label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nom complet" />
              </div>
              <div>
                <label className="text-sm font-medium">Votre téléphone</label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Téléphone" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={submitOrder} disabled={submitting}>
                {submitting ? 'Envoi...' : 'Confirmer la commande'}
              </Button>
              <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
                Annuler
              </Button>

              <AlertDialog>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer la commande</AlertDialogTitle>
                    <AlertDialogDescription>Voulez-vous vraiment passer cette commande maintenant ?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex justify-end gap-2 mt-4">
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={submitOrder}>{submitting ? 'Envoi...' : 'Confirmer'}</AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Cart;
