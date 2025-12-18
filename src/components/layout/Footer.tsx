import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Facebook, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo_realtech.svg';

const Footer = () => {
  const phoneNumber = '+221774220320';
  const whatsappLink = `https://wa.me/${phoneNumber}?text=Bonjour,%20je%20souhaite%20commander`;

  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <img src={logo} alt="RealTech" className="w-10 h-10 rounded-lg shadow-sm object-cover" />
              <h3 className="text-lg font-bold">RealTech Holding</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Votre partenaire de confiance pour l'impression, la sérigraphie et le matériel informatique au Sénégal.
            </p>
            <div className="flex space-x-3">
              <a href="#" className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-all">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-all">
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-base font-semibold mb-4">Liens Rapides</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Accueil
                </Link>
              </li>
              <li>
                <Link to="/serigraphie" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Sérigraphie
                </Link>
              </li>
              <li>
                <Link to="/flocage" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Flocage
                </Link>
              </li>
              <li>
                <Link to="/imprimantes" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Imprimantes & Machines
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-base font-semibold mb-4">Nos Services</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Sérigraphie personnalisée</li>
              <li>Flocage textile & objets</li>
              <li>Impression & Photocopie</li>
              <li>Conception graphique</li>
              <li>Vente de matériel informatique</li>
              <li>Machines à bâches</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-base font-semibold mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start space-x-2">
                <Phone className="w-4 h-4 mt-1 text-primary flex-shrink-0" />
                <div>
                  <a href={`tel:${phoneNumber}`} className="text-sm text-muted-foreground hover:text-primary transition-colors block">
                    +221 77 422 03 20
                  </a>
                  <span className="text-xs text-muted-foreground/70">Téléphone / WhatsApp</span>
                </div>
              </li>
              <li className="flex items-start space-x-2">
                <Mail className="w-4 h-4 mt-1 text-primary flex-shrink-0" />
                <a href="mailto:contact@realtech.sn" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  contact@realtech.sn
                </a>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 mt-1 text-primary flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Dakar, Sénégal
                </span>
              </li>
            </ul>
            <Button variant="whatsapp" size="sm" className="mt-4 w-full" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                Commander sur WhatsApp
              </a>
            </Button>
          </div>
        </div>

        <div className="border-t border-border/50 mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm text-muted-foreground text-center md:text-left">
              © 2025 RealTech Holding. Tous droits réservés.
            </p>
            <div className="flex space-x-6 text-sm text-muted-foreground">
              <Link to="/mentions-legales" className="hover:text-primary transition-colors">
                Mentions légales
              </Link>
              <Link to="/confidentialite" className="hover:text-primary transition-colors">
                Confidentialité
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
