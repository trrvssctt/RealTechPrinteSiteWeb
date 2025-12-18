import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import type { Product } from '@/data/products';

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const { addToCart } = useCart();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product);
  };

  return (
    <Link to={`/produit/${product.id}`} className="group">
      <div className="card-elegant overflow-hidden hover-lift">
        <div className="aspect-square overflow-hidden bg-muted">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        </div>
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {product.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {product.description}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-primary">
              {product.price.toLocaleString('fr-FR')} <span className="text-base font-normal">FCFA</span>
            </span>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" className="flex-1">
              Voir détails
            </Button>
            <Button variant="default" size="sm" onClick={handleAddToCart}>
              <ShoppingCart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
