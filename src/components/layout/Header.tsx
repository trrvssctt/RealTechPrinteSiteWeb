import { Link } from 'react-router-dom';
import logo from '@/assets/logo_realtech.svg';
import { Phone, ShoppingCart, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useState } from 'react';

const Header = () => {
  const { totalItems } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const phoneNumber = '+221774220320';
  const whatsappLink = `https://wa.me/${phoneNumber}?text=Bonjour,%20je%20souhaite%20commander`;

  const navLinks = [
    { name: 'Accueil', path: '/' },
    { name: 'Sérigraphie', path: '/serigraphie' },
    { name: 'Flocage', path: '/flocage' },
    { name: 'Flocage Personnalisé', path: '/flocage-personnalise' },
    { name: 'Imprimantes & Machines', path: '/imprimantes' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <img src={logo} alt="RealTech" className="w-12 h-12 rounded-lg shadow-md object-cover" />
            <div className="hidden md:block">
              <h1 className="text-xl font-bold text-foreground">RealTech Holding</h1>
              <p className="text-xs text-muted-foreground">Votre partenaire technologique</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors rounded-lg hover:bg-muted"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-3">
            <a href={`tel:${phoneNumber}`} className="hidden md:flex items-center space-x-2 text-foreground hover:text-primary transition-colors">
              <Phone className="w-4 h-4" />
              <span className="text-sm font-medium">+221 77 422 03 20</span>
            </a>

            <Button variant="whatsapp" size="sm" asChild className="hidden md:flex">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                Commander
              </a>
            </Button>

            <Link to="/panier" className="relative">
              <Button variant="outline" size="icon">
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {totalItems}
                  </span>
                )}
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="px-4 py-3 text-sm font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <a
                href={`tel:${phoneNumber}`}
                className="px-4 py-3 text-sm font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors flex items-center space-x-2"
              >
                <Phone className="w-4 h-4" />
                <span>+221 77 422 03 20</span>
              </a>
              <Button variant="whatsapp" size="sm" asChild className="mx-4">
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  Commander sur WhatsApp
                </a>
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;