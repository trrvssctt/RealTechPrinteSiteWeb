import tshirtsImg from '@/assets/tshirts-serigraphie.jpg';
import mugsImg from '@/assets/mugs-personnalises.jpg';
import casquettesImg from '@/assets/casquettes.jpg';
import sacsImg from '@/assets/sacs-publicitaires.jpg';
import flocageTextileImg from '@/assets/flocage-textile.jpg';
import maillotsImg from '@/assets/maillots-sports.jpg';
import vinyleImg from '@/assets/vinyle-decoupe.jpg';
import flocagePubImg from '@/assets/flocage-publicitaire.jpg';
import imprimanteLaserImg from '@/assets/imprimante-laser.jpg';
import photocopieuseImg from '@/assets/photocopieuse.jpg';
import machineBacheImg from '@/assets/machine-bache.jpg';
import imprimanteA3Img from '@/assets/imprimante-a3.jpg';
import encresImg from '@/assets/encres-consommables.jpg';
import plotterImg from '@/assets/plotter-decoupe.jpg';

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: 'serigraphie' | 'flocage' | 'imprimantes';
  description: string;
  featured?: boolean;
}

export const products: Product[] = [
  // Sérigraphie
  {
    id: 'serig-001',
    name: 'Sérigraphie T-Shirts Personnalisés',
    price: 5000,
    image: tshirtsImg,
    category: 'serigraphie',
    description: 'T-shirts personnalisés avec sérigraphie haute qualité. Idéal pour événements, entreprises et écoles. Plusieurs couleurs disponibles.',
    featured: true,
  },
  {
    id: 'serig-002',
    name: 'Sérigraphie Mugs Personnalisés',
    price: 3500,
    image: mugsImg,
    category: 'serigraphie',
    description: 'Mugs en céramique avec impression sérigraphique durable. Parfait pour cadeaux d\'entreprise ou événements.',
    featured: true,
  },
  {
    id: 'serig-003',
    name: 'Sérigraphie Casquettes',
    price: 4000,
    image: casquettesImg,
    category: 'serigraphie',
    description: 'Casquettes personnalisées avec broderie ou sérigraphie. Qualité premium, plusieurs styles disponibles.',
  },
  {
    id: 'serig-004',
    name: 'Sérigraphie Sacs Publicitaires',
    price: 2500,
    image: sacsImg,
    category: 'serigraphie',
    description: 'Sacs en tissu ou non-tissé avec impression personnalisée. Parfait pour promotions et événements.',
  },

  // Flocage
  {
    id: 'floc-001',
    name: 'Flocage Textile Professionnel',
    price: 7500,
    image: flocageTextileImg,
    category: 'flocage',
    description: 'Flocage textile haute qualité sur tout type de support. Résistant aux lavages, finition professionnelle.',
    featured: true,
  },
  {
    id: 'floc-002',
    name: 'Flocage Maillots Sports',
    price: 8000,
    image: maillotsImg,
    category: 'flocage',
    description: 'Personnalisation de maillots sportifs avec numéros et noms. Flocage durable et professionnel.',
  },
  {
    id: 'floc-003',
    name: 'Flocage Vinyle Découpe',
    price: 6000,
    image: vinyleImg,
    category: 'flocage',
    description: 'Découpe vinyle pour textiles et supports rigides. Plusieurs couleurs et finitions disponibles.',
  },
  {
    id: 'floc-004',
    name: 'Flocage Publicitaire',
    price: 5500,
    image: flocagePubImg,
    category: 'flocage',
    description: 'Flocage pour supports publicitaires, enseignes et véhicules. Qualité extérieure résistante.',
  },

  // Imprimantes
  {
    id: 'imp-001',
    name: 'Imprimante Laser Professionnelle',
    price: 450000,
    image: imprimanteLaserImg,
    category: 'imprimantes',
    description: 'Imprimante laser couleur haute vitesse. Idéale pour bureaux et entreprises. Garantie 1 an.',
    featured: true,
  },
  {
    id: 'imp-002',
    name: 'Photocopieuse Multifonction',
    price: 650000,
    image: photocopieuseImg,
    category: 'imprimantes',
    description: 'Photocopieuse, scanner et imprimante tout-en-un. Grande capacité papier, connexion réseau.',
  },
  {
    id: 'imp-003',
    name: 'Machine à Bâche Grand Format',
    price: 2500000,
    image: machineBacheImg,
    category: 'imprimantes',
    description: 'Imprimante grand format pour bâches publicitaires. Impression haute résolution jusqu\'à 3.2m de large.',
  },
  {
    id: 'imp-004',
    name: 'Imprimante A3 Couleur',
    price: 350000,
    image: imprimanteA3Img,
    category: 'imprimantes',
    description: 'Imprimante jet d\'encre A3 pour documents et photos. Qualité professionnelle, faible coût par page.',
  },
  {
    id: 'imp-005',
    name: 'Encres et Consommables',
    price: 25000,
    image: encresImg,
    category: 'imprimantes',
    description: 'Cartouches d\'encre, toners et papiers pour toutes marques. Stock permanent disponible.',
  },
  {
    id: 'imp-006',
    name: 'Plotter de Découpe',
    price: 850000,
    image: plotterImg,
    category: 'imprimantes',
    description: 'Machine de découpe vinyle professionnelle. Précision maximale pour signalétique et flocage.',
  },
];

export const getCategoryProducts = (category: string) => {
  return products.filter((p) => p.category === category);
};

export const getFeaturedProducts = () => {
  return products.filter((p) => p.featured);
};

export const getProductById = (id: string) => {
  return products.find((p) => p.id === id);
};
