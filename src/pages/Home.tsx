import { Link } from 'react-router-dom';
import { Printer, Palette, Shirt, Laptop, Star, CheckCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard';
import { useEffect, useState } from 'react';
import type { Product as ProductType } from '@/data/products';
import { apiFetch } from '@/lib/api';

async function fetchProducts() {
  const res = await apiFetch('/api/products');
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}
import heroImage from '@/assets/hero-serigraphie.jpg';

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState<ProductType[]>([]);

  useEffect(() => {
    let mounted = true;
    fetchProducts().then((rows) => {
      if (!mounted) return;
      const mappedAll = rows.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price || 0,
        image: p.image_url || (Array.isArray(p.images) && p.images[0]?.url) || '',
        category: typeof p.category === 'string' ? p.category : (p.category?.name || 'serigraphie'),
        description: p.short_description || p.description || '',
        featured: !!p.featured,
      }));

      // prefer products explicitly marked featured, otherwise fall back to first items
      const featured = mappedAll.filter((p) => p.featured);
      setFeaturedProducts(featured.length ? featured : mappedAll.slice(0, 6));
    });
    return () => {
      mounted = false;
    };
  }, []);
  const whatsappLink = 'https://wa.me/221774220320?text=Bonjour,%20je%20souhaite%20commander';

  const services = [
    {
      icon: Palette,
      title: 'Sérigraphie Personnalisée',
      description: 'Impression de qualité sur textiles, mugs, casquettes et plus encore',
    },
    {
      icon: Shirt,
      title: 'Flocage Textile & Objets',
      description: 'Marquage textile professionnel pour vos événements et entreprises',
    },
    {
      icon: Printer,
      title: 'Impression & Photocopie',
      description: 'Services d\'impression, numérisation et conception graphique',
    },
    {
      icon: Laptop,
      title: 'Matériel Informatique',
      description: 'Vente d\'imprimantes, photocopieuses, machines à bâches et consommables',
    },
  ];

  const advantages = [
    {
      icon: CheckCircle,
      title: 'Fiabilité et qualité garantie',
      description: 'Des produits testés et un service professionnel',
    },
    {
      icon: Users,
      title: 'Service client réactif',
      description: 'Une équipe à votre écoute pour répondre à vos besoins',
    },
    {
      icon: Star,
      title: 'Livraison rapide',
      description: 'Livraison dans toute la région de Dakar',
    },
  ];

  const testimonials = [
    {
      name: 'Amadou Diallo',
      role: 'Directeur Marketing',
      comment: 'Service impeccable et produits de qualité. RealTech est notre partenaire privilégié pour tous nos besoins en sérigraphie.',
      rating: 5,
    },
    {
      name: 'Fatou Seck',
      role: 'Gérante de boutique',
      comment: 'Très satisfaite de la réactivité et du professionnalisme. Les délais sont respectés et les prix compétitifs.',
      rating: 5,
    },
    {
      name: 'Omar Ba',
      role: 'Responsable événementiel',
      comment: 'Excellent rapport qualité-prix. L\'équipe est créative et propose toujours des solutions adaptées à nos projets.',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Atelier de sérigraphie" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/90 to-primary/70"></div>
        </div>
        <div className="container relative z-10 mx-auto px-4 text-center text-white animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Votre partenaire de confiance pour<br />
            <span className="text-primary-glow">l'impression et la sérigraphie</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
            Des solutions fiables pour tous vos besoins professionnels et créatifs au Sénégal
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" asChild>
              <Link to="/serigraphie">Découvrir nos produits</Link>
            </Button>
            <Button variant="whatsapp" size="lg" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                Commander sur WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="section-padding bg-background">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nos Services</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Une gamme complète de services pour répondre à tous vos besoins
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <div
                key={index}
                className="card-elegant p-6 text-center hover-lift animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary to-primary-glow rounded-2xl flex items-center justify-center shadow-lg">
                  <service.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{service.title}</h3>
                <p className="text-sm text-muted-foreground">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Produits Phares</h2>
            <p className="text-muted-foreground text-lg">Découvrez notre sélection de produits populaires</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {featuredProducts.map((product, index) => (
              <div key={product.id} className="animate-scale-in" style={{ animationDelay: `${index * 100}ms` }}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
          <div className="text-center">
            <Button variant="outline" size="lg" asChild>
              <Link to="/serigraphie">Voir tous les produits</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="section-padding bg-background">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Pourquoi nous choisir ?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {advantages.map((advantage, index) => (
              <div key={index} className="text-center animate-fade-in" style={{ animationDelay: `${index * 150}ms` }}>
                <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                  <advantage.icon className="w-10 h-10 text-primary" />
                </div>
                <h3 className="font-semibold text-xl mb-2">{advantage.title}</h3>
                <p className="text-muted-foreground">{advantage.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section-padding bg-gradient-to-br from-primary/5 to-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ce que disent nos clients</h2>
            <p className="text-muted-foreground text-lg">Des clients satisfaits à travers le Sénégal</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="card-elegant p-6 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex mb-3">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 italic">&ldquo;{testimonial.comment}&rdquo;</p>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-gradient-to-r from-primary to-primary-glow text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Prêt à commander ?</h2>
          <p className="text-xl mb-8 text-white/90">Contactez-nous dès maintenant pour discuter de votre projet</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="secondary" size="lg" asChild>
              <a href="tel:+221774220320">Appeler maintenant</a>
            </Button>
            <Button variant="whatsapp" size="lg" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                Commander sur WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
