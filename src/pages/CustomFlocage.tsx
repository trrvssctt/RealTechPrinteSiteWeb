import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Phone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface JerseyTemplate {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  pattern: 'solid' | 'stripes' | 'gradient';
}

const jerseyTemplates: JerseyTemplate[] = [
  { id: 'senegal', name: 'Sénégal', primaryColor: '#00853F', secondaryColor: '#FCD116', pattern: 'solid' },
  { id: 'maroc', name: 'Maroc', primaryColor: '#C8102E', secondaryColor: '#006233', pattern: 'solid' },
  { id: 'algerie', name: 'Algérie', primaryColor: '#006233', secondaryColor: '#ffffff', pattern: 'solid' },
  { id: 'cotedivoire', name: "Côte d'Ivoire", primaryColor: '#F77F00', secondaryColor: '#0066A1', pattern: 'solid' },
  { id: 'nigeria', name: 'Nigeria', primaryColor: '#008000', secondaryColor: '#ffffff', pattern: 'stripes' },
  { id: 'ghana', name: 'Ghana', primaryColor: '#006400', secondaryColor: '#FFD700', pattern: 'solid' },
  { id: 'cameroon', name: 'Cameroun', primaryColor: '#008000', secondaryColor: '#FFD700', pattern: 'solid' },
  { id: 'mali', name: 'Mali', primaryColor: '#008000', secondaryColor: '#FFD700', pattern: 'solid' },
  { id: 'egypt', name: 'Égypte', primaryColor: '#CE1126', secondaryColor: '#000000', pattern: 'solid' },
  { id: 'tunisie', name: 'Tunisie', primaryColor: '#E70013', secondaryColor: '#ffffff', pattern: 'solid' },

  { id: 'france', name: 'France', primaryColor: '#002395', secondaryColor: '#ED2939', pattern: 'solid' },
  { id: 'brazil', name: 'Brésil', primaryColor: '#009739', secondaryColor: '#FFDF00', pattern: 'solid' },
  { id: 'argentina', name: 'Argentine', primaryColor: '#6CABDD', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'portugal', name: 'Portugal', primaryColor: '#006600', secondaryColor: '#FF0000', pattern: 'gradient' },
  { id: 'spain', name: 'Espagne', primaryColor: '#AA151B', secondaryColor: '#F1BF00', pattern: 'solid' },
  { id: 'germany', name: 'Allemagne', primaryColor: '#000000', secondaryColor: '#FFCE00', pattern: 'solid' },
  { id: 'england', name: 'Angleterre', primaryColor: '#FFFFFF', secondaryColor: '#CC0000', pattern: 'solid' },
  { id: 'italy', name: 'Italie', primaryColor: '#0B5BA8', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'netherlands', name: 'Pays-Bas', primaryColor: '#FF7F00', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'belgium', name: 'Belgique', primaryColor: '#000000', secondaryColor: '#FFD100', pattern: 'solid' },

  { id: 'real-madrid', name: 'Real Madrid', primaryColor: '#FFFFFF', secondaryColor: '#000000', pattern: 'solid' },
  { id: 'fc-barcelona', name: 'FC Barcelone', primaryColor: '#A50044', secondaryColor: '#004D98', pattern: 'stripes' },
  { id: 'man-united', name: 'Manchester United', primaryColor: '#DA291C', secondaryColor: '#000000', pattern: 'solid' },
  { id: 'man-city', name: 'Manchester City', primaryColor: '#6CABDD', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'arsenal', name: 'Arsenal', primaryColor: '#EF0107', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'chelsea', name: 'Chelsea', primaryColor: '#034694', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'liverpool', name: 'Liverpool', primaryColor: '#C8102E', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'psg', name: 'Paris Saint-Germain (PSG)', primaryColor: '#004170', secondaryColor: '#DA0914', pattern: 'solid' },
  { id: 'bayern', name: 'Bayern Munich', primaryColor: '#DC052D', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'dortmund', name: 'Borussia Dortmund', primaryColor: '#FDE100', secondaryColor: '#000000', pattern: 'solid' },

  { id: 'juventus', name: 'Juventus', primaryColor: '#FFFFFF', secondaryColor: '#000000', pattern: 'stripes' },
  { id: 'ac-milan', name: 'AC Milan', primaryColor: '#000000', secondaryColor: '#FF0000', pattern: 'stripes' },
  { id: 'inter', name: 'Inter Milan', primaryColor: '#004D98', secondaryColor: '#000000', pattern: 'stripes' },
  { id: 'atletico', name: 'Atlético Madrid', primaryColor: '#D50000', secondaryColor: '#1E90FF', pattern: 'stripes' },
  { id: 'napoli', name: 'Napoli', primaryColor: '#1D4E89', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'ajax', name: 'Ajax Amsterdam', primaryColor: '#FFFFFF', secondaryColor: '#000000', pattern: 'solid' },
  { id: 'porto', name: 'FC Porto', primaryColor: '#003399', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'benfica', name: 'Benfica', primaryColor: '#FF0000', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'al-ahly', name: 'Al Ahly', primaryColor: '#D71920', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'wydad', name: 'Wydad Casablanca', primaryColor: '#C8102E', secondaryColor: '#FFFFFF', pattern: 'solid' },

  { id: 'om', name: 'Olympique de Marseille', primaryColor: '#00A3E0', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'as-monaco', name: 'AS Monaco', primaryColor: '#FFFFFF', secondaryColor: '#E30613', pattern: 'solid' },
  { id: 'leverkusen', name: 'Bayer Leverkusen', primaryColor: '#000000', secondaryColor: '#E4002B', pattern: 'solid' },
  { id: 'rb-leipzig', name: 'RB Leipzig', primaryColor: '#C8102E', secondaryColor: '#FFFFFF', pattern: 'solid' },
  { id: 'tottenham', name: 'Tottenham Hotspur', primaryColor: '#FFFFFF', secondaryColor: '#091A35', pattern: 'solid' },
  { id: 'west-ham', name: 'West Ham', primaryColor: '#7A263A', secondaryColor: '#1A3C40', pattern: 'solid' },
  { id: 'galatasaray', name: 'Galatasaray', primaryColor: '#A71930', secondaryColor: '#FDB913', pattern: 'stripes' },
  { id: 'fenerbahce', name: 'Fenerbahçe', primaryColor: '#002A5C', secondaryColor: '#FDB913', pattern: 'solid' },
  { id: 'flamengo', name: 'Flamengo', primaryColor: '#000000', secondaryColor: '#DE1B1B', pattern: 'stripes' },
  { id: 'al-nassr', name: 'Al Nassr', primaryColor: '#003366', secondaryColor: '#FFD700', pattern: 'solid' },
];

const CustomFlocage = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [garmentType, setGarmentType] = useState<'maillot' | 'tshirt'>('maillot');
  const [selectedJersey, setSelectedJersey] = useState<JerseyTemplate | null>(null);
  const [flocageType, setFlocageType] = useState<'name' | 'name_number'>('name_number');
  const [textFront, setTextFront] = useState('');
  const [textBack, setTextBack] = useState('');
  const [number, setNumber] = useState('');
  const [color, setColor] = useState('blanc');
  const [size, setSize] = useState('M');
  const [additionalInfo, setAdditionalInfo] = useState('');

  // service price: 2000 FCFA without a number, 2500 FCFA when a number is provided
  const servicePrice = number && number.trim().length > 0 ? 2500 : 2000;

  const handleAddToCart = () => {
    // validation
    if (!textFront || textFront.trim().length === 0) {
      toast.error('Le nom est requis pour le flocage');
      return;
    }
    // Number is optional; pricing adjusts if a number is provided.

    const customProduct = {
      id: `flocage-${Date.now()}`,
      name: `Flocage - ${selectedJersey ? selectedJersey.name + ' - ' : ''}${textFront}${number ? ' #' + number : ''}`,
      price: servicePrice,
      image: selectedJersey ? undefined : (garmentType === 'maillot' ? '/src/assets/maillots-sports.jpg' : '/src/assets/tshirts-serigraphie.jpg'),
      category: 'flocage',
      metadata: {
        garmentType,
        team: selectedJersey?.name || null,
        textFront,
        textBack,
        number,
        color,
        size,
        additionalInfo,
        flocageType
      },
      quantity: 1
    };

    addToCart(customProduct);
    navigate('/panier');
  };

  const handleWhatsAppOrder = () => {
    // validation
    if (!textFront || textFront.trim().length === 0) {
      toast.error('Le nom est requis pour le flocage');
      return;
    }
    // Number is optional for WhatsApp orders as well; price will reflect presence of number.

    const message = `Bonjour, je souhaite commander un flocage :\n\n` +
      `Équipe : ${selectedJersey ? selectedJersey.name : (garmentType === 'maillot' ? 'Maillot' : 'T-shirt')}\n` +
      `Nom : ${textFront}\n` +
      `${number ? `Numéro : ${number}\n` : ''}` +
      `Type : ${flocageType === 'name' ? 'Nom' : 'Nom + Numéro'}\n` +
      `Prix : ${servicePrice.toLocaleString('fr-FR')} FCFA\n\n` +
      `NB : J'apporte mon propre maillot` + (additionalInfo ? `\nInfos: ${additionalInfo}` : '');
    
    const whatsappUrl = `https://wa.me/221774220320?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const getJerseyBackground = (jersey: JerseyTemplate) => {
    if (jersey.pattern === 'solid') {
      return jersey.primaryColor;
    } else if (jersey.pattern === 'stripes') {
      return `repeating-linear-gradient(90deg, ${jersey.primaryColor}, ${jersey.primaryColor} 20px, ${jersey.secondaryColor} 20px, ${jersey.secondaryColor} 40px)`;
    } else {
      return `linear-gradient(135deg, ${jersey.primaryColor}, ${jersey.secondaryColor})`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-4 gradient-text">
            Flocage Personnalisé
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Créez votre maillot ou t-shirt personnalisé avec votre nom, numéro et message.
            Apportez votre vêtement et nous le floquons selon vos préférences.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Preview Section */}
          <Card className="card-elegant h-fit md:sticky md:top-4">
            <CardHeader>
              <CardTitle>Aperçu en temps réel</CardTitle>
              <CardDescription>Visualisez votre design sur le maillot sélectionné</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative bg-muted rounded-lg p-6 md:p-8 md:min-h-[500px] flex items-center justify-center">
                <div className="relative">
                  {/* Garment illustration with selected jersey */}
                  <div 
                    className="w-48 h-60 sm:w-56 sm:h-72 md:w-64 md:h-80 border-4 rounded-lg flex flex-col items-center justify-center shadow-xl relative overflow-hidden"
                    style={{
                      background: selectedJersey ? getJerseyBackground(selectedJersey) : '#ffffff',
                      borderColor: selectedJersey ? selectedJersey.secondaryColor : 'hsl(var(--primary) / 0.2)',
                    }}
                  >
                    {/* Jersey collar */}
                    <div 
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-8 rounded-b-full"
                      style={{
                        background: selectedJersey ? selectedJersey.secondaryColor : '#e5e7eb',
                      }}
                    />
                    
                    {/* Jersey sleeves */}
                    <div 
                      className="absolute top-8 -left-2 w-12 h-24 rounded-l-full"
                      style={{
                        background: selectedJersey ? getJerseyBackground(selectedJersey) : '#ffffff',
                      }}
                    />
                    <div 
                      className="absolute top-8 -right-2 w-12 h-24 rounded-r-full"
                      style={{
                        background: selectedJersey ? getJerseyBackground(selectedJersey) : '#ffffff',
                      }}
                    />
                    
                    <div className="text-center space-y-6 z-10 mt-8">
                      {/* Front text */}
                      {textFront && (
                        <div 
                          className="text-xl sm:text-2xl font-bold px-4 drop-shadow-lg"
                          style={{ 
                            color: color === 'blanc' ? '#ffffff' : color === 'noir' ? '#000000' : color === 'bleu' ? '#0056D2' : color === 'rouge' ? '#DC2626' : color === 'jaune' ? '#FCD116' : '#22C55E',
                            textShadow: color === 'blanc' ? '2px 2px 4px rgba(0,0,0,0.5)' : '2px 2px 4px rgba(0,0,0,0.3)'
                          }}
                        >
                          {textFront}
                        </div>
                      )}
                      
                      {/* Number */}
                      {number && (
                        <div 
                          className="text-5xl sm:text-6xl md:text-7xl font-black drop-shadow-lg"
                          style={{ 
                            color: color === 'blanc' ? '#ffffff' : color === 'noir' ? '#000000' : color === 'bleu' ? '#0056D2' : color === 'rouge' ? '#DC2626' : color === 'jaune' ? '#FCD116' : '#22C55E',
                            textShadow: color === 'blanc' ? '3px 3px 6px rgba(0,0,0,0.5)' : '3px 3px 6px rgba(0,0,0,0.3)'
                          }}
                        >
                          {number}
                        </div>
                      )}
                      
                      {/* Back text preview indicator */}
                      {textBack && (
                        <div className="text-xs bg-background/80 backdrop-blur px-2 py-1 rounded">
                          Dos: {textBack}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 text-center">
                    <p className="text-sm font-semibold text-foreground">
                      {selectedJersey ? selectedJersey.name : garmentType === 'maillot' ? 'Maillot de foot' : 'T-shirt blanc'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Taille: {size}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-primary mt-2">
                      {servicePrice.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Section */}
          <div className="space-y-6">
            <Card className="card-elegant">
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>
                  Personnalisez votre vêtement selon vos préférences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Garment Type */}
                <div className="space-y-2">
                  <Label htmlFor="garmentType">Type de vêtement</Label>
                  <Select value={garmentType} onValueChange={(value: 'maillot' | 'tshirt') => {
                    setGarmentType(value);
                    if (value === 'tshirt') setSelectedJersey(null);
                  }}>
                    <SelectTrigger id="garmentType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      <SelectItem value="maillot">Maillot de foot (15,000 FCFA)</SelectItem>
                      <SelectItem value="tshirt">T-shirt blanc (10,000 FCFA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Jersey Template Selection */}
                {garmentType === 'maillot' && (
                  <div className="space-y-3">
                    <Label>Choisissez un maillot d'équipe</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {jerseyTemplates.map((jersey) => (
                        <button
                          key={jersey.id}
                          onClick={() => setSelectedJersey(jersey)}
                          className={cn(
                            "relative h-24 rounded-lg border-2 transition-all hover:scale-105",
                            selectedJersey?.id === jersey.id 
                              ? "border-primary ring-2 ring-primary shadow-lg" 
                              : "border-border hover:border-primary/50"
                          )}
                          style={{
                            background: getJerseyBackground(jersey),
                          }}
                        >
                          {selectedJersey?.id === jersey.id && (
                            <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                          <div className="absolute bottom-1 left-0 right-0 bg-background/90 backdrop-blur py-1">
                            <p className="text-xs font-medium text-foreground text-center">
                              {jersey.name}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                    {selectedJersey && (
                      <p className="text-sm text-muted-foreground">
                        Maillot sélectionné: <span className="font-semibold text-foreground">{selectedJersey.name}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Text Front */}
                <div className="space-y-2">
                  <Label htmlFor="textFront">Texte devant (optionnel)</Label>
                  <Input
                    id="textFront"
                    placeholder="Ex: SENEGAL, VOTRE NOM..."
                    value={textFront}
                    onChange={(e) => setTextFront(e.target.value.toUpperCase())}
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">{textFront.length}/20 caractères</p>
                </div>

                {/* Number */}
                <div className="space-y-2">
                  <Label htmlFor="number">Numéro (optionnel)</Label>
                  <Input
                    id="number"
                    type="text"
                    placeholder="Ex: 10, 7, 99..."
                    value={number}
                    onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                    maxLength={2}
                  />
                </div>

                {/* Text Back */}
                <div className="space-y-2">
                  <Label htmlFor="textBack">Texte dos (optionnel)</Label>
                  <Input
                    id="textBack"
                    placeholder="Ex: NOM DE FAMILLE..."
                    value={textBack}
                    onChange={(e) => setTextBack(e.target.value.toUpperCase())}
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">{textBack.length}/20 caractères</p>
                </div>

                {/* Color */}
                <div className="space-y-2">
                  <Label htmlFor="color">Couleur du flocage</Label>
                  <Select value={color} onValueChange={setColor}>
                    <SelectTrigger id="color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="blanc">Blanc</SelectItem>
                      <SelectItem value="noir">Noir</SelectItem>
                      <SelectItem value="bleu">Bleu</SelectItem>
                      <SelectItem value="rouge">Rouge</SelectItem>
                      <SelectItem value="jaune">Jaune</SelectItem>
                      <SelectItem value="vert">Vert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Size */}
                <div className="space-y-2">
                  <Label htmlFor="size">Taille du vêtement</Label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger id="size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="XS">XS</SelectItem>
                      <SelectItem value="S">S</SelectItem>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="XL">XL</SelectItem>
                      <SelectItem value="XXL">XXL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Additional Info */}
                <div className="space-y-2">
                  <Label htmlFor="additionalInfo">Informations supplémentaires (optionnel)</Label>
                  <Textarea
                    id="additionalInfo"
                    placeholder="Précisions sur la police, position spéciale, délais souhaités..."
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleAddToCart}
                disabled={!textFront && !textBack && !number}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                Ajouter au panier
              </Button>
              
              <Button 
                variant="whatsapp" 
                className="w-full" 
                size="lg"
                onClick={handleWhatsAppOrder}
                disabled={!textFront && !textBack && !number}
              >
                <Phone className="mr-2 h-5 w-5" />
                Commander via WhatsApp
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-foreground">📋 Important :</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Apportez votre propre maillot ou t-shirt</li>
                <li>Le vêtement doit être propre et en bon état</li>
                <li>Délai de réalisation : 24-48h</li>
                <li>Le prix inclut le flocage uniquement</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomFlocage;