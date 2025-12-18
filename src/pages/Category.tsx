import { useLocation, Link } from 'react-router-dom';
import ProductCard from '@/components/ProductCard';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import serigraphieImg from '@/assets/hero-serigraphie.jpg';
import flocageImg from '@/assets/flocage.jpg';
import imprimantesImg from '@/assets/imprimantes.jpg';

const categoryInfo = {
  serigraphie: {
    title: 'Sérigraphie Personnalisée',
    description: 'Impression de haute qualité sur textiles, objets publicitaires et supports divers. Idéal pour événements, entreprises et promotions.',
    image: serigraphieImg,
  },
  flocage: {
    title: 'Flocage Textile & Objets',
    description: 'Marquage textile professionnel avec flocage vinyle. Résistant aux lavages, parfait pour maillots sportifs, vêtements de travail et signalétique.',
    image: flocageImg,
  },
  imprimantes: {
    title: 'Imprimantes & Machines Bâche',
    description: 'Vente de matériel informatique professionnel : imprimantes, photocopieuses, machines à bâches, plotters et consommables.',
    image: imprimantesImg,
  },
};

const Category = () => {
  const location = useLocation();
  const category = location.pathname.substring(1); // Remove leading slash

  const getCategoryName = (c: any) => {
    if (!c) return '';
    if (typeof c === 'string') return c;
    if (typeof c === 'object') return c.name || c.label || String(c.id || '');
    return String(c);
  };
  const slugify = (s: string) =>
    s
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await apiFetch('/api/products');
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  const routeSlug = slugify(category || '');

  const products = (allProducts as any[])
    .filter((p) => {
      const pSlug = slugify(getCategoryName(p.category) || '');
      if (!routeSlug) return false;
      return pSlug === routeSlug || pSlug.includes(routeSlug) || routeSlug.includes(pSlug);
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price || 0,
      image: p.image_url || (Array.isArray(p.images) && p.images[0]?.url) || '',
      category: getCategoryName(p.category) || category,
      description: p.short_description || p.description || '',
    }));
  const info = categoryInfo[category as keyof typeof categoryInfo];

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Catégorie non trouvée</h1>
          <Link to="/" className="text-primary hover:underline">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Banner */}
      <section className="relative h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={info.image} alt={info.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/90 to-primary/80"></div>
        </div>
        <div className="container relative z-10 mx-auto px-4 text-center text-white animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{info.title}</h1>
          <p className="text-lg md:text-xl text-white/90 max-w-3xl mx-auto">{info.description}</p>
        </div>
      </section>

      {/* Products Grid */}
      <section className="section-padding bg-background">
        <div className="container mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Nos Produits</h2>
            <p className="text-muted-foreground">
              {products.length} produit{products.length > 1 ? 's' : ''} disponible{products.length > 1 ? 's' : ''}
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-12">Chargement des produits...</div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product, index) => (
                <div key={product.id} className="animate-scale-in" style={{ animationDelay: `${index * 50}ms` }}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">Aucun produit disponible pour le moment.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Category;
