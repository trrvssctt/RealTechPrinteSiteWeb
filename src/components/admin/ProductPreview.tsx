import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";

interface ProductPreviewProps {
  data: {
    name: string;
    short_description: string;
    price: string;
    images: Array<{ url: string; alt: string; is_primary: boolean }>;
    in_stock: boolean;
    featured: boolean;
    stock: string;
    threshold: string;
  };
}

export const ProductPreview = ({ data }: ProductPreviewProps) => {
  const primaryImage = data.images.find(img => img.is_primary) || data.images[0];
  const stock = parseInt(data.stock) || 0;
  const threshold = parseInt(data.threshold) || 5;
  const isLowStock = stock <= threshold && stock > 0;

  return (
    <Card className="overflow-hidden">
      <div className="aspect-square relative bg-muted">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={primaryImage.alt}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ShoppingCart className="h-16 w-16" />
          </div>
        )}
        
        {data.featured && (
          <Badge className="absolute top-2 right-2 bg-primary">
            ⭐ Vedette
          </Badge>
        )}
        
        {!data.in_stock && (
          <Badge variant="destructive" className="absolute top-2 left-2">
            Rupture de stock
          </Badge>
        )}
        
        {isLowStock && data.in_stock && (
          <Badge variant="secondary" className="absolute top-2 left-2 bg-orange-500 text-white">
            Stock faible
          </Badge>
        )}
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg line-clamp-2 mb-2">
          {data.name || "Nom du produit"}
        </h3>
        
        {data.short_description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {data.short_description}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-primary">
            {data.price ? `${parseInt(data.price).toLocaleString()} FCFA` : "Prix"}
          </span>
          
          {data.in_stock && (
            <span className="text-xs text-muted-foreground">
              Stock: {stock}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
