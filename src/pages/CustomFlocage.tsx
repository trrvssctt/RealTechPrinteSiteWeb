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
  { id: 'lions', name: 'Lions', primaryColor: '#FFD700', secondaryColor: '#8B0000', pattern: 'stripes' },
  { id: 'asec', name: 'ASEC', primaryColor: '#FFD700', secondaryColor: '#000000', pattern: 'solid' },
  { id: 'jaa', name: 'JAA', primaryColor: '#FF0000', secondaryColor: '#FFFFFF', pattern: 'stripes' },
  { id: 'casa', name: 'Casa Sports', primaryColor: '#0056D2', secondaryColor: '#FFFFFF', pattern: 'gradient' },
  { id: 'us-goree', name: 'US Gorée', primaryColor: '#000000', secondaryColor: '#FFD700', pattern: 'solid' },
  { id: 'niary-tally', name: 'Niary Tally', primaryColor: '#8B0000', secondaryColor: '#FFFFFF', pattern: 'stripes' },
  { id: 'teungueth', name: 'Teungueth FC', primaryColor: '#0056D2', secondaryColor: '#FFD700', pattern: 'gradient' },
];

const CustomFlocage = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [garmentType, setGarmentType] = useState<'maillot' | 'tshirt'>('maillot');
  const [selectedJersey, setSelectedJersey] = useState<JerseyTemplate | null>(null);
  const [textFront, setTextFront] = useState('');
  const [textBack, setTextBack] = useState('');
  const [number, setNumber] = useState('');
  const [color, setColor] = useState('blanc');
  const [size, setSize] = useState('M');
  const [additionalInfo, setAdditionalInfo] = useState('');

  const basePrice = garmentType === 'maillot' ? 15000 : 10000;

  const handleAddToCart = () => {
    const customProduct = {
      id: `custom-${Date.now()}`,
      name: `Flocage ${garmentType === 'maillot' ? 'Maillot' : 'T-shirt'} personnalisé${selectedJersey ? ` - ${selectedJersey.name}` : ''}`,
      price: basePrice,
      image: garmentType === 'maillot' 
        ? '/src/assets/maillots-sports.jpg'
        : '/src/assets/tshirts-serigraphie.jpg',
      category: 'flocage',
      description: `
        Type: ${garmentType === 'maillot' ? 'Maillot de foot' : 'T-shirt blanc'}
        ${selectedJersey ? `Équipe: ${selectedJersey.name}` : ''}
        ${textFront ? `Texte devant: ${textFront}` : ''}
        ${textBack ? `Texte dos: ${textBack}` : ''}
        ${number ? `Numéro: ${number}` : ''}
        Couleur flocage: ${color}
        Taille: ${size}
        ${additionalInfo ? `Infos: ${additionalInfo}` : ''}
      `.trim()
    };
    
    addToCart(customProduct);
    navigate('/panier');
  };

  const handleWhatsAppOrder = () => {
    const message = `Bonjour, je souhaite commander un flocage personnalisé:\n\n` +
      `Type: ${garmentType === 'maillot' ? 'Maillot de foot' : 'T-shirt blanc'}\n` +
      `${selectedJersey ? `Équipe: ${selectedJersey.name}\n` : ''}` +
      `${textFront ? `Texte devant: ${textFront}\n` : ''}` +
      `${textBack ? `Texte dos: ${textBack}\n` : ''}` +
      `${number ? `Numéro: ${number}\n` : ''}` +
      `Couleur flocage: ${color}\n` +
      `Taille: ${size}\n` +
      `${additionalInfo ? `Informations supplémentaires: ${additionalInfo}\n` : ''}` +
      `\nPrix: ${basePrice.toLocaleString('fr-FR')} FCFA`;
    
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
          <Card className="card-elegant h-fit sticky top-4">
            <CardHeader>
              <CardTitle>Aperçu en temps réel</CardTitle>
              <CardDescription>Visualisez votre design sur le maillot sélectionné</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative bg-muted rounded-lg p-8 min-h-[500px] flex items-center justify-center">
                <div className="relative">
                  {/* Garment illustration with selected jersey */}
                  <div 
                    className="w-64 h-80 border-4 rounded-lg flex flex-col items-center justify-center shadow-xl relative overflow-hidden"
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
                          className="text-2xl font-bold px-4 drop-shadow-lg"
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
                          className="text-7xl font-black drop-shadow-lg"
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
                    <p className="text-2xl font-bold text-primary mt-2">
                      {basePrice.toLocaleString('fr-FR')} FCFA
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