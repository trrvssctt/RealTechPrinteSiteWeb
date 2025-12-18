import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { useAnalytics } from '@/hooks/useAnalytics';
import { apiFetch } from '@/lib/api';

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  description?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const { sessionId } = useAnalytics();

  // Charger le panier depuis la DB
  useEffect(() => {
    loadCart();
  }, [sessionId]);

  // Sauvegarder le panier dans la DB quand il change
  useEffect(() => {
    if (cart.length > 0) {
      saveCart();
    }
  }, [cart]);

  const loadCart = async () => {
    try {
      const resp = await apiFetch(`/api/carts?session_id=${encodeURIComponent(sessionId)}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setCartId(data.id);
      // load items from cart_items
      const itemsResp = await apiFetch(`/api/carts/${data.id}/items`);
      if (itemsResp.ok) {
        const itemsData = await itemsResp.json();
        const items = Array.isArray(itemsData) ? itemsData : [];
        setCart(items.map((item: any) => ({
          id: item.product_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image || '',
          category: item.category || '',
        })));
      }
    } catch (err) {
      // ignore
    }
  };

  const saveCart = async () => {
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const cartItems = cart.map(item => ({
      product_id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
      category: item.category,
    }));

    if (cartId) {
      await apiFetch(`/api/carts/${cartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartItems, total_amount: totalAmount })
      });
    } else {
      const resp = await apiFetch('/api/carts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, user_id: null, items: cartItems, total_amount: totalAmount })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.id) setCartId(data.id);
      } else {
        console.warn('Failed to create cart', resp.status);
      }
    }
  };

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        toast.success('Quantité mise à jour');
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      toast.success('Produit ajouté au panier');
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
    toast.success('Produit retiré du panier');
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) => (item.id === productId ? { ...item, quantity } : item))
    );
  };

  const clearCart = async () => {
    setCart([]);
    if (cartId) {
      await apiFetch(`/api/carts/${cartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      setCartId(null);
    }
    toast.success('Panier vidé');
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
