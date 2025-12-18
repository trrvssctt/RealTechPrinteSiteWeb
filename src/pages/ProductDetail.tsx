import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Phone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import ProductCard from '@/components/ProductCard';
import { useEffect, useState } from 'react';
import type { Product as ProductType } from '@/data/products';
import { apiFetch } from '@/lib/api';

async function fetchProduct(id: string) {
  const res = await apiFetch(`/api/products/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data || null;
}

async function fetchAllProducts() {
  const res = await apiFetch('/api/products');
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<ProductType | null>(null);
  const [similarProducts, setSimilarProducts] = useState<ProductType[]>([]);

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    fetchProduct(id).then((p) => {
      if (!mounted) return;
      if (!p) {
        setProduct(null);
        return;
      }
      const getCategoryName = (c: any) => {
        if (!c) return 'serigraphie';
        if (typeof c === 'string') return c;
        if (typeof c === 'object') return c.name || c.label || String(c.id || 'serigraphie');
        return String(c);
      };

      const mapped: ProductType = {
        id: p.id,
        name: p.name,
        price: p.price || 0,
        image: p.image_url || (Array.isArray(p.images) && p.images[0]?.url) || '',
        category: getCategoryName(p.category),
        description: p.short_description || p.description || '',
      };
      setProduct(mapped);

      // fetch similar
      fetchAllProducts().then((all) => {
        if (!mounted) return;
        const similar = all
          .filter((x: any) => {
            if (x.id === p.id) return false;
            const a = getCategoryName(x.category);
            const b = getCategoryName(p.category);
            return a === b;
          })
          .slice(0, 3)
          .map((q: any) => ({
            id: q.id,
            name: q.name,
            price: q.price || 0,
            image: q.image_url || (Array.isArray(q.images) && q.images[0]?.url) || '',
            category: getCategoryName(q.category),
            description: q.short_description || q.description || '',
          }));
        setSimilarProducts(similar);
      });
    });
    return () => {
      mounted = false;
    };
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Produit non trouvé</h1>
          <Button asChild>
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    );
  }

  // similarProducts state is managed by effect

  const whatsappMessage = encodeURIComponent(
    `Bonjour, je souhaite commander : ${product.name} (${product.price.toLocaleString('fr-FR')} FCFA)`
  );
  const whatsappLink = `https://wa.me/221774220320?text=${whatsappMessage}`;

  const handleAddToCart = () => {
    addToCart(product);
    navigate('/panier');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>

        {/* Product Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Image */}
          <div className="animate-scale-in">
            <div className="aspect-square rounded-2xl overflow-hidden shadow-2xl">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col justify-center animate-fade-in">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4 w-fit">
              {product.category.charAt(0).toUpperCase() + product.category.slice(1)}
            </div>
            <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
            <p className="text-3xl font-bold text-primary mb-6">
              {product.price.toLocaleString('fr-FR')} <span className="text-xl font-normal">FCFA</span>
            </p>
            <div className="prose prose-lg mb-8">
              <p className="text-muted-foreground text-lg">{product.description}</p>
            </div>

            <div className="space-y-4">
              <Button variant="default" size="lg" onClick={handleAddToCart} className="w-full">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Ajouter au panier
              </Button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button variant="whatsapp" size="lg" asChild>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    Commander sur WhatsApp
                  </a>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a href="tel:+221774220320">
                    <Phone className="w-5 h-5 mr-2" />
                    Appeler
                  </a>
                </Button>
              </div>
            </div>

            <div className="mt-8 p-6 bg-muted/50 rounded-xl">
              <h3 className="font-semibold mb-3">Informations</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Livraison disponible dans toute la région de Dakar</li>
                <li>✓ Paiement sécurisé à la livraison</li>
                <li>✓ Service client disponible du lundi au samedi</li>
                <li>✓ Produits de qualité garantie</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <section>
            <h2 className="text-3xl font-bold mb-8">Produits similaires</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
