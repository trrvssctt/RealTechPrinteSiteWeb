import { useState } from 'react';
import { Phone, Mail, MapPin, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (async () => {
      try {
        setSubmitting(true);
        const payload = {
          name: formData.name,
          email: formData.email,
          message: formData.message,
        } as any;

        const resp = await apiFetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          let errText = 'Erreur lors de l\'envoi';
          try {
            const json = await resp.json();
            errText = json.error || (json.errors ? json.errors.map((x:any)=>x.msg).join(', ') : errText);
          } catch (e) {}
          toast.error(errText);
          return;
        }

        // success: notify user and reset
        toast.success('Message envoyé — nous vous répondrons bientôt');
        setFormData({ name: '', email: '', message: '' });

        // Optionally open WhatsApp for immediate contact (keeps previous behaviour)
        /*try {
          const whatsappMessage = encodeURIComponent(
            `Nouveau message de ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
          );
          const whatsappLink = `https://wa.me/221774220320?text=${whatsappMessage}`;
          window.open(whatsappLink, '_blank');
        } catch (e) {
          // ignore pop-up failures
        }*/
      } catch (err) {
        console.error(err);
        toast.error('Erreur réseau lors de l\'envoi');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const contactInfo = [
    {
      icon: Phone,
      title: 'Téléphone / WhatsApp',
      value: '+221 77 422 03 20',
      link: 'tel:+221774220320',
    },
    {
      icon: Mail,
      title: 'Email',
      value: 'sidydiop.boss@realtechprint.com',
      link: 'mailto:sidydiop.boss@realtechprint.com',
    },
    {
      icon: MapPin,
      title: 'Adresse',
      value: 'Dakar, Sénégal',
      link: '#',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-r from-primary to-primary-glow text-white py-16">
        <div className="container mx-auto px-4 text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Contactez-nous</h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Notre équipe est à votre écoute pour répondre à toutes vos questions
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="animate-fade-in">
            <div className="card-elegant p-8">
              <h2 className="text-2xl font-bold mb-6">Envoyez-nous un message</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Nom complet
                  </label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Votre nom"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="votre@email.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Votre message..."
                    rows={6}
                    required
                  />
                </div>
                <Button type="submit" size="lg" className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer le message
                </Button>
              </form>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="card-elegant p-8">
              <h2 className="text-2xl font-bold mb-6">Informations de contact</h2>
              <div className="space-y-6">
                {contactInfo.map((info, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <info.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{info.title}</h3>
                      {info.link === '#' ? (
                        <p className="text-muted-foreground">{info.value}</p>
                      ) : (
                        <a
                          href={info.link}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {info.value}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-elegant p-8">
              <h3 className="text-xl font-bold mb-4">Horaires d'ouverture</h3>
              <div className="space-y-2 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Lundi - Vendredi</span>
                  <span className="font-semibold">8h - 18h</span>
                </div>
                <div className="flex justify-between">
                  <span>Samedi</span>
                  <span className="font-semibold">9h - 15h</span>
                </div>
                <div className="flex justify-between">
                  <span>Dimanche</span>
                  <span className="font-semibold text-destructive">Fermé</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button variant="whatsapp" size="lg" className="w-full" asChild>
                <a
                  href="https://wa.me/221774220320?text=Bonjour,%20je%20souhaite%20des%20informations"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Commander sur WhatsApp
                </a>
              </Button>
              <Button variant="outline" size="lg" className="w-full" asChild>
                <a href="tel:+221774220320">Appeler maintenant</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
